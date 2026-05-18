import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useList } from '../useList';
import * as client from '@/lib/supabase/client';
import * as realtime from '@/lib/supabase/realtime';

// Mock Supabase client
vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

// Mock realtime subscriptions
vi.mock('@/lib/supabase/realtime', () => ({
  subscribeToListItems: vi.fn(),
  subscribeToListMetadata: vi.fn(),
  unsubscribeFromChannel: vi.fn(),
}));

describe('useList Hook', () => {
  let mockSupabase: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = client.supabase as any;
  });

  describe('initial load', () => {
    it('should fetch list and items on mount', async () => {
      const mockListQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValueOnce({
          data: { id: 'list-1', name: 'Test List', type: 'supermarket' },
          error: null,
        }),
      };

      const mockItemsQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValueOnce({
          data: [
            { id: 'item-1', name: 'Milk', list_id: 'list-1', ticked: false },
          ],
          error: null,
        }),
      };

      mockSupabase.from
        .mockReturnValueOnce(mockListQuery)
        .mockReturnValueOnce(mockItemsQuery);

      const { result } = renderHook(() => useList('list-1'));

      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.list).toEqual(
        expect.objectContaining({ id: 'list-1', name: 'Test List' })
      );
      expect(result.current.items).toHaveLength(1);
      expect(result.current.items[0].name).toBe('Milk');
    });

    it('should handle errors during fetch', async () => {
      const mockListQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValueOnce({
          data: null,
          error: { message: 'Not found' },
        }),
      };

      mockSupabase.from.mockReturnValueOnce(mockListQuery);

      const { result } = renderHook(() => useList('list-1'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe('Not found');
      expect(result.current.list).toBeNull();
    });
  });

  describe('optimistic updates', () => {
    it('should update item optimistically', async () => {
      const mockListQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValueOnce({
          data: { id: 'list-1', name: 'Test List' },
          error: null,
        }),
      };

      const mockItemsQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValueOnce({
          data: [{ id: 'item-1', name: 'Milk', ticked: false }],
          error: null,
        }),
      };

      mockSupabase.from
        .mockReturnValueOnce(mockListQuery)
        .mockReturnValueOnce(mockItemsQuery);

      const { result } = renderHook(() => useList('list-1'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      act(() => {
        result.current.updateOptimistically({
          id: 'item-1',
          name: 'Milk',
          ticked: true,
          list_id: 'list-1',
          order_index: 0,
          created_by_user_id: 'user-1',
          created_at: '',
          updated_at: '',
        });
      });

      expect(result.current.items[0].ticked).toBe(true);
    });

    it('should add new item optimistically', async () => {
      const mockListQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValueOnce({
          data: { id: 'list-1', name: 'Test List' },
          error: null,
        }),
      };

      const mockItemsQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValueOnce({
          data: [],
          error: null,
        }),
      };

      mockSupabase.from
        .mockReturnValueOnce(mockListQuery)
        .mockReturnValueOnce(mockItemsQuery);

      const { result } = renderHook(() => useList('list-1'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.items).toHaveLength(0);

      act(() => {
        result.current.updateOptimistically({
          id: 'item-2',
          name: 'Bread',
          ticked: false,
          list_id: 'list-1',
          order_index: 0,
          created_by_user_id: 'user-1',
          created_at: '',
          updated_at: '',
        });
      });

      expect(result.current.items).toHaveLength(1);
      expect(result.current.items[0].name).toBe('Bread');
    });
  });

  describe('subscriptions', () => {
    it('should set up subscriptions on mount', async () => {
      const mockListQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValueOnce({
          data: { id: 'list-1' },
          error: null,
        }),
      };

      const mockItemsQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValueOnce({
          data: [],
          error: null,
        }),
      };

      mockSupabase.from
        .mockReturnValueOnce(mockListQuery)
        .mockReturnValueOnce(mockItemsQuery);

      const mockSubscribeItems = vi.fn().mockReturnValue(null);
      vi.mocked(realtime.subscribeToListItems).mockImplementation(mockSubscribeItems);

      renderHook(() => useList('list-1'));

      await waitFor(() => {
        expect(mockSubscribeItems).toHaveBeenCalledWith('list-1', expect.any(Function));
      });
    });

    it('should clean up subscriptions on unmount', async () => {
      const mockListQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValueOnce({
          data: { id: 'list-1' },
          error: null,
        }),
      };

      const mockItemsQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValueOnce({
          data: [],
          error: null,
        }),
      };

      mockSupabase.from
        .mockReturnValueOnce(mockListQuery)
        .mockReturnValueOnce(mockItemsQuery);

      const mockChannel = {};
      vi.mocked(realtime.subscribeToListItems).mockReturnValue(mockChannel as any);
      vi.mocked(realtime.subscribeToListMetadata).mockReturnValue(mockChannel as any);

      const { unmount } = renderHook(() => useList('list-1'));

      await waitFor(() => {
        unmount();
      });

      await waitFor(() => {
        expect(realtime.unsubscribeFromChannel).toHaveBeenCalledWith(mockChannel);
      });
    });
  });

  describe('refetch', () => {
    it('should refetch data when called', async () => {
      const mockListQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'list-1', name: 'Test List' },
          error: null,
        }),
      };

      const mockItemsQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      };

      mockSupabase.from
        .mockReturnValue({ ...mockListQuery, ...mockItemsQuery });

      const { result } = renderHook(() => useList('list-1'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      act(() => {
        result.current.refetch();
      });

      await waitFor(() => {
        expect(mockListQuery.single).toHaveBeenCalled();
      });
    });
  });
});
