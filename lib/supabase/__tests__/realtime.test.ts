import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  subscribeToListItems,
  subscribeToListMetadata,
  subscribeToListSnapshots,
  unsubscribeFromChannel,
} from '../realtime';
import * as client from '../client';

// Mock Supabase client
vi.mock('../client', () => ({
  supabase: {
    channel: vi.fn(),
  },
}));

describe('Realtime Subscriptions', () => {
  let mockChannel: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock channel object
    mockChannel = {
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    };

    const mockSupabase = client.supabase as any;
    mockSupabase.channel.mockReturnValue(mockChannel);
  });

  describe('subscribeToListItems', () => {
    it('should create a channel with list_id filter', () => {
      const mockCallback = vi.fn();
      const listId = 'test-list-123';

      subscribeToListItems(listId, mockCallback);

      const mockSupabase = client.supabase as any;
      expect(mockSupabase.channel).toHaveBeenCalledWith(`list-items:${listId}`);
    });

    it('should subscribe to insert, update, delete events', () => {
      const mockCallback = vi.fn();
      const listId = 'test-list-123';

      subscribeToListItems(listId, mockCallback);

      expect(mockChannel.on).toHaveBeenCalledWith(
        'postgres_changes',
        expect.objectContaining({
          event: '*',
          schema: 'public',
          table: 'items',
          filter: `list_id=eq.${listId}`,
        }),
        mockCallback
      );
    });

    it('should return null if listId is empty', () => {
      const mockCallback = vi.fn();
      const result = subscribeToListItems('', mockCallback);

      expect(result).toBeNull();
    });

    it('should call subscribe after setting up channel', () => {
      const mockCallback = vi.fn();
      subscribeToListItems('test-list-123', mockCallback);

      expect(mockChannel.subscribe).toHaveBeenCalled();
    });
  });

  describe('subscribeToListMetadata', () => {
    it('should create a channel for list updates only', () => {
      const mockCallback = vi.fn();
      const listId = 'test-list-123';

      subscribeToListMetadata(listId, mockCallback);

      expect(mockChannel.on).toHaveBeenCalledWith(
        'postgres_changes',
        expect.objectContaining({
          event: 'UPDATE',
          schema: 'public',
          table: 'lists',
          filter: `id=eq.${listId}`,
        }),
        mockCallback
      );
    });

    it('should return null if listId is empty', () => {
      const mockCallback = vi.fn();
      const result = subscribeToListMetadata('', mockCallback);

      expect(result).toBeNull();
    });
  });

  describe('subscribeToListSnapshots', () => {
    it('should create a channel for snapshot inserts only', () => {
      const mockCallback = vi.fn();
      const listId = 'test-list-123';

      subscribeToListSnapshots(listId, mockCallback);

      expect(mockChannel.on).toHaveBeenCalledWith(
        'postgres_changes',
        expect.objectContaining({
          event: 'INSERT',
          schema: 'public',
          table: 'list_snapshots',
          filter: `list_id=eq.${listId}`,
        }),
        mockCallback
      );
    });

    it('should return null if listId is empty', () => {
      const mockCallback = vi.fn();
      const result = subscribeToListSnapshots('', mockCallback);

      expect(result).toBeNull();
    });
  });

  describe('unsubscribeFromChannel', () => {
    it('should unsubscribe from a channel', async () => {
      const mockSupabase = client.supabase as any;
      mockSupabase.removeChannel = vi.fn();

      const channel = { test: 'channel' } as any;
      await unsubscribeFromChannel(channel);

      expect(mockSupabase.removeChannel).toHaveBeenCalledWith(channel);
    });

    it('should handle null channel gracefully', async () => {
      const mockSupabase = client.supabase as any;
      mockSupabase.removeChannel = vi.fn();

      await unsubscribeFromChannel(null);

      expect(mockSupabase.removeChannel).not.toHaveBeenCalled();
    });
  });
});
