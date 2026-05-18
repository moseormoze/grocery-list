'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import {
  subscribeToListItems,
  subscribeToListMetadata,
  unsubscribeFromChannel,
} from '@/lib/supabase/realtime';
import type { Item, List } from '@/lib/db/types';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

export interface UseListState {
  list: List | null;
  items: Item[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook for fetching a list and its items with realtime sync.
 * Automatically subscribes to changes and unsubscribes on unmount.
 * Supports optimistic updates via updateOptimistically.
 */
export function useList(listId: string): UseListState & { updateOptimistically: (item: Item) => void } {
  const [list, setList] = useState<List | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const itemsChannelRef = useRef<ReturnType<typeof subscribeToListItems>>(null);
  const listChannelRef = useRef<ReturnType<typeof subscribeToListMetadata>>(null);

  // Optimistic updates: apply change to local state immediately
  const updateOptimistically = useCallback((item: Item) => {
    setItems((prev) => {
      const index = prev.findIndex((i) => i.id === item.id);
      if (index > -1) {
        const updated = [...prev];
        updated[index] = item;
        return updated;
      }
      return [...prev, item];
    });
  }, []);

  // Fetch initial list data
  const fetchList = useCallback(async () => {
    if (!listId) {
      setError('List ID is required');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch list metadata
      const { data: listData, error: listError } = await supabase
        .from('lists')
        .select('*')
        .eq('id', listId)
        .single();

      if (listError) {
        throw new Error(listError.message);
      }

      setList(listData);

      // Fetch items
      const { data: itemsData, error: itemsError } = await supabase
        .from('items')
        .select('*')
        .eq('list_id', listId)
        .order('order_index', { ascending: true });

      if (itemsError) {
        throw new Error(itemsError.message);
      }

      setItems(itemsData || []);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [listId]);

  // Handle realtime item changes
  const handleItemsChange = useCallback(
    (payload: RealtimePostgresChangesPayload<Item>) => {
      if (payload.eventType === 'INSERT') {
        setItems((prev) => [...prev, payload.new]);
      } else if (payload.eventType === 'UPDATE') {
        setItems((prev) =>
          prev.map((item) => (item.id === payload.new.id ? payload.new : item))
        );
      } else if (payload.eventType === 'DELETE') {
        setItems((prev) => prev.filter((item) => item.id !== payload.old.id));
      }
    },
    []
  );

  // Handle realtime list metadata changes
  const handleListChange = useCallback((payload: RealtimePostgresChangesPayload<List>) => {
    if (payload.eventType === 'UPDATE') {
      setList(payload.new);
    }
  }, []);

  // Set up subscriptions on mount
  useEffect(() => {
    fetchList();

    if (listId) {
      itemsChannelRef.current = subscribeToListItems(listId, handleItemsChange);
      listChannelRef.current = subscribeToListMetadata(listId, handleListChange);
    }

    // Cleanup subscriptions on unmount
    return () => {
      if (itemsChannelRef.current) {
        unsubscribeFromChannel(itemsChannelRef.current);
      }
      if (listChannelRef.current) {
        unsubscribeFromChannel(listChannelRef.current);
      }
    };
  }, [listId, fetchList, handleItemsChange, handleListChange]);

  const refetch = useCallback(async () => {
    await fetchList();
  }, [fetchList]);

  return {
    list,
    items,
    loading,
    error,
    refetch,
    updateOptimistically,
  };
}
