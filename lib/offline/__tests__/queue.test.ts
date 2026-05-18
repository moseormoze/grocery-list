import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OfflineQueue, NetworkSimulator, resolveConflict, getOfflineQueue } from '../queue';
import type { QueuedMutation } from '../queue';

describe('OfflineQueue', () => {
  let queue: OfflineQueue;

  beforeEach(() => {
    vi.clearAllMocks();
    // Clear localStorage
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
    queue = new OfflineQueue();
  });

  afterEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  describe('enqueue and getUnsyncedMutations', () => {
    it('should add mutation to queue', () => {
      const mutation = {
        id: 'mut-1',
        listId: 'list-1',
        itemId: 'item-1',
        type: 'insert' as const,
        data: { name: 'Milk' },
        timestamp: Date.now(),
      };

      queue.enqueue(mutation);

      expect(queue.getUnsyncedMutations()).toHaveLength(1);
      expect(queue.getUnsyncedMutations()[0]).toMatchObject(mutation);
    });

    it('should mark mutations as unsynced by default', () => {
      const mutation = {
        id: 'mut-1',
        listId: 'list-1',
        type: 'insert' as const,
        data: { name: 'Milk' },
        timestamp: Date.now(),
      };

      queue.enqueue(mutation);

      expect(queue.getUnsyncedMutations()[0].synced).toBe(false);
    });

    it('should enqueue multiple mutations in order', () => {
      const now = Date.now();

      queue.enqueue({
        id: 'mut-1',
        listId: 'list-1',
        type: 'insert' as const,
        data: { name: 'Milk' },
        timestamp: now,
      });

      queue.enqueue({
        id: 'mut-2',
        listId: 'list-1',
        type: 'update' as const,
        itemId: 'item-1',
        data: { ticked: true },
        timestamp: now + 100,
      });

      const unsynced = queue.getUnsyncedMutations();
      expect(unsynced).toHaveLength(2);
      expect(unsynced[0].id).toBe('mut-1');
      expect(unsynced[1].id).toBe('mut-2');
    });
  });

  describe('markSynced', () => {
    it('should mark a mutation as synced', () => {
      queue.enqueue({
        id: 'mut-1',
        listId: 'list-1',
        type: 'insert' as const,
        data: { name: 'Milk' },
        timestamp: Date.now(),
      });

      queue.markSynced('mut-1');

      const unsynced = queue.getUnsyncedMutations();
      expect(unsynced).toHaveLength(0);

      const all = queue.getAll();
      expect(all[0].synced).toBe(true);
    });

    it('should not affect other mutations', () => {
      const now = Date.now();

      queue.enqueue({
        id: 'mut-1',
        listId: 'list-1',
        type: 'insert' as const,
        data: { name: 'Milk' },
        timestamp: now,
      });

      queue.enqueue({
        id: 'mut-2',
        listId: 'list-1',
        type: 'update' as const,
        itemId: 'item-1',
        data: { ticked: true },
        timestamp: now + 100,
      });

      queue.markSynced('mut-1');

      const unsynced = queue.getUnsyncedMutations();
      expect(unsynced).toHaveLength(1);
      expect(unsynced[0].id).toBe('mut-2');
    });
  });

  describe('markSyncedUpTo', () => {
    it('should mark all mutations up to timestamp as synced', () => {
      const now = Date.now();

      queue.enqueue({
        id: 'mut-1',
        listId: 'list-1',
        type: 'insert' as const,
        data: { name: 'Milk' },
        timestamp: now,
      });

      queue.enqueue({
        id: 'mut-2',
        listId: 'list-1',
        type: 'update' as const,
        itemId: 'item-1',
        data: { ticked: true },
        timestamp: now + 100,
      });

      queue.enqueue({
        id: 'mut-3',
        listId: 'list-1',
        type: 'delete' as const,
        itemId: 'item-2',
        data: {},
        timestamp: now + 200,
      });

      queue.markSyncedUpTo(now + 100);

      const unsynced = queue.getUnsyncedMutations();
      expect(unsynced).toHaveLength(1);
      expect(unsynced[0].id).toBe('mut-3');
    });
  });

  describe('removeSyncedMutations', () => {
    it('should remove synced mutations from queue', () => {
      queue.enqueue({
        id: 'mut-1',
        listId: 'list-1',
        type: 'insert' as const,
        data: { name: 'Milk' },
        timestamp: Date.now(),
      });

      queue.enqueue({
        id: 'mut-2',
        listId: 'list-1',
        type: 'update' as const,
        itemId: 'item-1',
        data: { ticked: true },
        timestamp: Date.now() + 100,
      });

      queue.markSynced('mut-1');
      queue.removeSyncedMutations();

      expect(queue.getAll()).toHaveLength(1);
      expect(queue.getAll()[0].id).toBe('mut-2');
    });

    it('should not affect unsynced mutations', () => {
      queue.enqueue({
        id: 'mut-1',
        listId: 'list-1',
        type: 'insert' as const,
        data: { name: 'Milk' },
        timestamp: Date.now(),
      });

      queue.removeSyncedMutations();

      expect(queue.getAll()).toHaveLength(1);
    });
  });

  describe('clear', () => {
    it('should clear entire queue', () => {
      queue.enqueue({
        id: 'mut-1',
        listId: 'list-1',
        type: 'insert' as const,
        data: { name: 'Milk' },
        timestamp: Date.now(),
      });

      queue.clear();

      expect(queue.getAll()).toHaveLength(0);
    });
  });

  describe('subscribe', () => {
    it('should notify listeners on mutation', () => {
      const listener = vi.fn();
      queue.subscribe(listener);

      queue.enqueue({
        id: 'mut-1',
        listId: 'list-1',
        type: 'insert' as const,
        data: { name: 'Milk' },
        timestamp: Date.now(),
      });

      expect(listener).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ id: 'mut-1' }),
        ])
      );
    });

    it('should unsubscribe on returned function call', () => {
      const listener = vi.fn();
      const unsubscribe = queue.subscribe(listener);

      unsubscribe();

      queue.enqueue({
        id: 'mut-1',
        listId: 'list-1',
        type: 'insert' as const,
        data: { name: 'Milk' },
        timestamp: Date.now(),
      });

      expect(listener).not.toHaveBeenCalled();
    });
  });
});

describe('NetworkSimulator', () => {
  let simulator: NetworkSimulator;

  beforeEach(() => {
    simulator = new NetworkSimulator();
  });

  describe('goOffline and goOnline', () => {
    it('should track online/offline state', () => {
      expect(simulator.getStatus()).toBe(true);

      simulator.goOffline();
      expect(simulator.getStatus()).toBe(false);

      simulator.goOnline();
      expect(simulator.getStatus()).toBe(true);
    });

    it('should notify listeners on state change', () => {
      const listener = vi.fn();
      simulator.subscribe(listener);

      simulator.goOffline();
      expect(listener).toHaveBeenCalledWith(false);

      simulator.goOnline();
      expect(listener).toHaveBeenCalledWith(true);
    });
  });

  describe('subscribe', () => {
    it('should allow subscribing to state changes', () => {
      const listener = vi.fn();
      simulator.subscribe(listener);

      simulator.goOffline();

      expect(listener).toHaveBeenCalledWith(false);
    });

    it('should unsubscribe on returned function call', () => {
      const listener = vi.fn();
      const unsubscribe = simulator.subscribe(listener);

      unsubscribe();

      simulator.goOffline();

      expect(listener).not.toHaveBeenCalled();
    });
  });
});

describe('resolveConflict', () => {
  it('should prefer local mutation if newer', () => {
    const now = Date.now();
    const mutation: QueuedMutation = {
      id: 'mut-1',
      listId: 'list-1',
      type: 'update' as const,
      data: { ticked: true },
      timestamp: now + 100,
      synced: false,
    };

    const serverVersion = { ticked: false };

    const result = resolveConflict(mutation, serverVersion);

    expect(result).toEqual(mutation.data);
  });

  it('should prefer server version if older', () => {
    const now = Date.now();
    const mutation: QueuedMutation = {
      id: 'mut-1',
      listId: 'list-1',
      type: 'update' as const,
      data: { ticked: true },
      timestamp: now - 100,
      synced: false,
    };

    const serverVersion = { ticked: false };

    const result = resolveConflict(mutation, serverVersion);

    expect(result).toEqual(serverVersion);
  });
});

describe('getOfflineQueue', () => {
  it('should return singleton instance', () => {
    const q1 = getOfflineQueue();
    const q2 = getOfflineQueue();

    expect(q1).toBe(q2);
  });
});
