import { describe, it, expect, vi, beforeEach } from 'vitest';
import { replayOfflineMutations, mutateTolerant } from '../sync';
import * as client from '../client';
import * as queueModule from '@/lib/offline/queue';

// Mock dependencies
vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock('@/lib/offline/queue', () => ({
  getOfflineQueue: vi.fn(),
}));

describe('Sync Logic', () => {
  let mockSupabase: any;
  let mockQueue: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = client.supabase as any;
    mockQueue = {
      getUnsyncedMutations: vi.fn().mockReturnValue([]),
      markSynced: vi.fn(),
      removeSyncedMutations: vi.fn(),
    };
    vi.mocked(queueModule.getOfflineQueue).mockReturnValue(mockQueue);
  });

  describe('replayOfflineMutations', () => {
    it('should return success with 0 synced when queue is empty', async () => {
      mockQueue.getUnsyncedMutations.mockReturnValue([]);

      const result = await replayOfflineMutations();

      expect(result.success).toBe(true);
      expect(result.synced).toBe(0);
      expect(result.failed).toBe(0);
    });

    it('should mark mutations as synced after successful replay', async () => {
      const mutation = {
        id: 'mut-1',
        listId: 'list-1',
        itemId: 'item-1',
        type: 'insert' as const,
        data: { name: 'Milk' },
        timestamp: Date.now(),
        synced: false,
      };

      mockQueue.getUnsyncedMutations.mockReturnValue([mutation]);

      const mockInsert = vi.fn().mockReturnValue({
        error: null,
      });

      mockSupabase.from.mockReturnValue({
        insert: mockInsert,
      });

      const result = await replayOfflineMutations();

      expect(result.success).toBe(true);
      expect(result.synced).toBe(1);
      expect(mockQueue.markSynced).toHaveBeenCalledWith('mut-1');
    });

    it('should continue replaying on individual mutation failures', async () => {
      const mutation1 = {
        id: 'mut-1',
        listId: 'list-1',
        itemId: 'item-1',
        type: 'insert' as const,
        data: { name: 'Milk' },
        timestamp: Date.now(),
        synced: false,
      };

      const mutation2 = {
        id: 'mut-2',
        listId: 'list-1',
        itemId: 'item-1',
        type: 'update' as const,
        data: { ticked: true },
        timestamp: Date.now() + 100,
        synced: false,
      };

      mockQueue.getUnsyncedMutations.mockReturnValue([mutation1, mutation2]);

      const mockInsert = vi.fn().mockReturnValueOnce({
        error: { message: 'Insert failed' },
      });

      const mockUpdate = vi.fn().mockReturnValueOnce({
        error: null,
      });

      mockSupabase.from
        .mockReturnValueOnce({ insert: mockInsert })
        .mockReturnValueOnce({ update: mockUpdate, eq: vi.fn().mockReturnThis() });

      const result = await replayOfflineMutations();

      expect(result.success).toBe(false);
      expect(result.synced).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
    });

    it('should replay mutations in timestamp order', async () => {
      const now = Date.now();

      const mutation1 = {
        id: 'mut-1',
        listId: 'list-1',
        type: 'insert' as const,
        data: { name: 'Milk' },
        timestamp: now,
        synced: false,
      };

      const mutation2 = {
        id: 'mut-2',
        listId: 'list-1',
        itemId: 'item-1',
        type: 'update' as const,
        data: { ticked: true },
        timestamp: now + 100,
        synced: false,
      };

      // Return in reverse order to test sorting
      mockQueue.getUnsyncedMutations.mockReturnValue([mutation2, mutation1]);

      const insertCalls: any[] = [];
      const updateCalls: any[] = [];

      const mockInsert = vi.fn((data) => {
        insertCalls.push(data);
        return { error: null };
      });

      const mockUpdate = vi.fn((data) => {
        updateCalls.push(data);
        return { error: null };
      });

      mockSupabase.from
        .mockReturnValueOnce({
          insert: mockInsert,
        })
        .mockReturnValueOnce({
          update: mockUpdate,
          eq: vi.fn().mockReturnThis(),
        });

      await replayOfflineMutations();

      // Insert should be called before update
      expect(mockInsert).toHaveBeenCalled();
      expect(mockUpdate).toHaveBeenCalled();
    });

    it('should remove synced mutations after replay', async () => {
      const mutation = {
        id: 'mut-1',
        listId: 'list-1',
        type: 'insert' as const,
        data: { name: 'Milk' },
        timestamp: Date.now(),
        synced: false,
      };

      mockQueue.getUnsyncedMutations.mockReturnValue([mutation]);

      mockSupabase.from.mockReturnValue({
        insert: vi.fn().mockReturnValue({ error: null }),
      });

      await replayOfflineMutations();

      expect(mockQueue.removeSyncedMutations).toHaveBeenCalled();
    });
  });

  describe('mutateTolerant', () => {
    it('should queue mutation when offline', async () => {
      mockQueue.enqueue = vi.fn();

      const mutation = {
        id: 'mut-1',
        listId: 'list-1',
        itemId: 'item-1',
        type: 'insert' as const,
        data: { name: 'Milk' },
        timestamp: Date.now(),
      };

      const result = await mutateTolerant(mutation, false);

      expect(result.success).toBe(true);
      expect(mockQueue.enqueue).toHaveBeenCalled();
    });

    it('should apply mutation immediately when online', async () => {
      const mockInsert = vi.fn().mockReturnValue({
        error: null,
      });

      mockSupabase.from.mockReturnValue({
        insert: mockInsert,
      });

      const mutation = {
        id: 'mut-1',
        listId: 'list-1',
        itemId: 'item-1',
        type: 'insert' as const,
        data: { name: 'Milk' },
        timestamp: Date.now(),
      };

      const result = await mutateTolerant(mutation, true);

      expect(result.success).toBe(true);
      expect(mockInsert).toHaveBeenCalled();
    });

    it('should return error when mutation fails online', async () => {
      const mockInsert = vi.fn().mockReturnValue({
        error: { message: 'Insert failed' },
      });

      mockSupabase.from.mockReturnValue({
        insert: mockInsert,
      });

      const mutation = {
        id: 'mut-1',
        listId: 'list-1',
        type: 'insert' as const,
        data: { name: 'Milk' },
        timestamp: Date.now(),
      };

      const result = await mutateTolerant(mutation, true);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Insert failed');
    });
  });
});
