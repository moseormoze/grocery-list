import { supabase } from './client';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import type { Item } from '@/lib/db/types';

export type RealtimeCallback = (payload: RealtimePostgresChangesPayload<Item>) => void;

/**
 * Subscribe to items changes in a list.
 * Calls the callback whenever an item is inserted, updated, or deleted.
 */
export function subscribeToListItems(
  listId: string,
  onItemsChange: RealtimeCallback
): RealtimeChannel | null {
  if (!listId) {
    console.warn('subscribeToListItems: listId is required');
    return null;
  }

  const channel = supabase
    .channel(`list-items:${listId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'items',
        filter: `list_id=eq.${listId}`,
      },
      onItemsChange
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log(`Subscribed to items in list ${listId}`);
      } else if (status === 'CHANNEL_ERROR') {
        console.error(`Channel error for list ${listId}`);
      }
    });

  return channel;
}

/**
 * Subscribe to list metadata changes (name, type, updated_at).
 */
export function subscribeToListMetadata(
  listId: string,
  onListChange: (payload: RealtimePostgresChangesPayload<any>) => void
): RealtimeChannel | null {
  if (!listId) {
    console.warn('subscribeToListMetadata: listId is required');
    return null;
  }

  const channel = supabase
    .channel(`list-metadata:${listId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'lists',
        filter: `id=eq.${listId}`,
      },
      onListChange
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log(`Subscribed to metadata for list ${listId}`);
      }
    });

  return channel;
}

/**
 * Subscribe to list snapshots (trip completions).
 */
export function subscribeToListSnapshots(
  listId: string,
  onSnapshotCreate: (payload: RealtimePostgresChangesPayload<any>) => void
): RealtimeChannel | null {
  if (!listId) {
    console.warn('subscribeToListSnapshots: listId is required');
    return null;
  }

  const channel = supabase
    .channel(`list-snapshots:${listId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'list_snapshots',
        filter: `list_id=eq.${listId}`,
      },
      onSnapshotCreate
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log(`Subscribed to snapshots for list ${listId}`);
      }
    });

  return channel;
}

/**
 * Unsubscribe from a channel and clean up.
 */
export async function unsubscribeFromChannel(channel: RealtimeChannel | null) {
  if (!channel) return;

  await supabase.removeChannel(channel);
}
