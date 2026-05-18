/**
 * Offline-tolerant sync coordinator.
 * Replays queued mutations to Supabase when connection returns.
 */

import { supabase } from './client';
import { getOfflineQueue, type QueuedMutation } from '@/lib/offline/queue';

export interface SyncResult {
  success: boolean;
  synced: number;
  failed: number;
  errors: string[];
}

/**
 * Replay all unsynced mutations in order.
 * Called when app detects connection restored.
 */
export async function replayOfflineMutations(): Promise<SyncResult> {
  const queue = getOfflineQueue();
  const mutations = queue.getUnsyncedMutations();

  if (mutations.length === 0) {
    return { success: true, synced: 0, failed: 0, errors: [] };
  }

  const result: SyncResult = { success: true, synced: 0, failed: 0, errors: [] };

  // Replay in order of timestamp
  const sorted = [...mutations].sort((a, b) => a.timestamp - b.timestamp);

  for (const mutation of sorted) {
    try {
      await replayMutation(mutation);
      queue.markSynced(mutation.id);
      result.synced++;
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      result.errors.push(`Mutation ${mutation.id}: ${error}`);
      result.failed++;
      // Don't stop on error; continue replaying remaining mutations
    }
  }

  // Clean up synced mutations
  queue.removeSyncedMutations();

  result.success = result.failed === 0;
  return result;
}

/**
 * Replay a single mutation to Supabase.
 */
async function replayMutation(mutation: QueuedMutation): Promise<void> {
  if (mutation.type === 'insert') {
    await insertItem(mutation);
  } else if (mutation.type === 'update') {
    await updateItem(mutation);
  } else if (mutation.type === 'delete') {
    await deleteItem(mutation);
  } else {
    throw new Error(`Unknown mutation type: ${mutation.type}`);
  }
}

/**
 * Insert item (add to list).
 */
async function insertItem(mutation: QueuedMutation): Promise<void> {
  const { error } = await supabase
    .from('items')
    .insert({
      id: mutation.itemId,
      list_id: mutation.listId,
      ...mutation.data,
      created_at: new Date(mutation.timestamp).toISOString(),
    });

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Update item (tick, edit, reorder).
 */
async function updateItem(mutation: QueuedMutation): Promise<void> {
  const { error } = await supabase
    .from('items')
    .update({
      ...mutation.data,
      updated_at: new Date(mutation.timestamp).toISOString(),
    })
    .eq('id', mutation.itemId);

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Delete item.
 */
async function deleteItem(mutation: QueuedMutation): Promise<void> {
  const { error } = await supabase
    .from('items')
    .delete()
    .eq('id', mutation.itemId);

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Attempt mutation with offline fallback.
 * If online, apply to server. If offline, queue locally.
 */
export async function mutateTolerant(
  mutation: Omit<QueuedMutation, 'id' | 'synced'>,
  isOnline: boolean
): Promise<{ success: boolean; error?: string }> {
  if (!isOnline) {
    // Offline: queue locally
    const queue = getOfflineQueue();
    queue.enqueue({
      ...mutation,
      id: generateMutationId(),
    });
    return { success: true };
  }

  // Online: apply to server
  try {
    await replayMutation({
      ...mutation,
      id: generateMutationId(),
      synced: true,
    });
    return { success: true };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return { success: false, error };
  }
}

/**
 * Generate a unique ID for a mutation.
 */
function generateMutationId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
