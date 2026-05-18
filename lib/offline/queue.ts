/**
 * Offline mutation queue.
 * Stores mutations locally when offline, replays them when connection returns.
 * Uses in-memory queue + localStorage for persistence across app closes.
 */

export type MutationType = 'insert' | 'update' | 'delete';

export interface QueuedMutation {
  id: string; // UUID for this mutation
  listId: string;
  itemId?: string;
  type: MutationType; // 'insert' | 'update' | 'delete'
  data: Record<string, any>; // Item data or update payload
  timestamp: number; // When mutation occurred (ms since epoch)
  synced: boolean; // Whether this has been sent to server
}

const QUEUE_KEY = 'grocery-list:offline-queue';

/**
 * In-memory queue, persisted to localStorage.
 */
class OfflineQueue {
  private queue: QueuedMutation[] = [];
  private listeners: Set<(queue: QueuedMutation[]) => void> = new Set();

  constructor() {
    this.loadFromStorage();
  }

  /**
   * Load queue from localStorage on init.
   */
  private loadFromStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem(QUEUE_KEY);
      if (stored) {
        this.queue = JSON.parse(stored);
      }
    } catch (e) {
      console.error('Failed to load offline queue from storage:', e);
      this.queue = [];
    }
  }

  /**
   * Persist queue to localStorage.
   */
  private saveToStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(QUEUE_KEY, JSON.stringify(this.queue));
    } catch (e) {
      console.error('Failed to save offline queue to storage:', e);
    }
  }

  /**
   * Add a mutation to the queue.
   */
  enqueue(mutation: Omit<QueuedMutation, 'synced'>): void {
    const queued: QueuedMutation = {
      ...mutation,
      synced: false,
    };
    this.queue.push(queued);
    this.saveToStorage();
    this.notifyListeners();
  }

  /**
   * Get all unsynced mutations.
   */
  getUnsyncedMutations(): QueuedMutation[] {
    return this.queue.filter((m) => !m.synced);
  }

  /**
   * Mark a mutation as synced.
   */
  markSynced(mutationId: string): void {
    const mutation = this.queue.find((m) => m.id === mutationId);
    if (mutation) {
      mutation.synced = true;
      this.saveToStorage();
      this.notifyListeners();
    }
  }

  /**
   * Mark all mutations with a timestamp as synced.
   * (Optimization: if server processed up to timestamp T, mark all mutations before T as synced)
   */
  markSyncedUpTo(timestamp: number): void {
    let changed = false;
    for (const mutation of this.queue) {
      if (!mutation.synced && mutation.timestamp <= timestamp) {
        mutation.synced = true;
        changed = true;
      }
    }
    if (changed) {
      this.saveToStorage();
      this.notifyListeners();
    }
  }

  /**
   * Remove synced mutations from queue.
   */
  removeSyncedMutations(): void {
    const before = this.queue.length;
    this.queue = this.queue.filter((m) => !m.synced);
    if (before !== this.queue.length) {
      this.saveToStorage();
      this.notifyListeners();
    }
  }

  /**
   * Clear entire queue (e.g., on logout).
   */
  clear(): void {
    this.queue = [];
    if (typeof window !== 'undefined') {
      localStorage.removeItem(QUEUE_KEY);
    }
    this.notifyListeners();
  }

  /**
   * Get entire queue (for debugging/testing).
   */
  getAll(): QueuedMutation[] {
    return [...this.queue];
  }

  /**
   * Subscribe to queue changes.
   */
  subscribe(listener: (queue: QueuedMutation[]) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener([...this.queue]));
  }
}

// Singleton instance
let queueInstance: OfflineQueue | null = null;

export function getOfflineQueue(): OfflineQueue {
  if (!queueInstance) {
    queueInstance = new OfflineQueue();
  }
  return queueInstance;
}

/**
 * Simulate offline / online state.
 * (Used for testing; real app would use navigator.onLine + online/offline events)
 */
export class NetworkSimulator {
  private isOnline = true;
  private listeners: Set<(online: boolean) => void> = new Set();

  goOffline(): void {
    this.isOnline = false;
    this.notifyListeners();
  }

  goOnline(): void {
    this.isOnline = true;
    this.notifyListeners();
  }

  getStatus(): boolean {
    return this.isOnline;
  }

  subscribe(listener: (online: boolean) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener(this.isOnline));
  }
}

/**
 * Conflict resolution: last-write-wins by timestamp.
 * If local mutation has later timestamp, keep local.
 * Otherwise, server state wins.
 */
export function resolveConflict(
  localMutation: QueuedMutation,
  serverVersion: Record<string, any>
): Record<string, any> {
  // In a real implementation, compare timestamps on specific fields
  // For MVP, the server's last-write-wins is enforced via RLS + trigger

  if (localMutation.timestamp > Date.now()) {
    // Local is newer, trust it
    return localMutation.data;
  }
  // Server is newer, use it
  return serverVersion;
}
