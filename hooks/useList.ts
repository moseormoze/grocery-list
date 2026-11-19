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
export function useList(listId: string): UseListState & { appendImported: (items: Item[]) => void; updateOptimistically: (item: Item) => void; deleteOptimistically: (itemId: string) => void; reorderOptimistically: (orderedIds: string[]) => void } {
  const [list, setList] = useState<List | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const itemsChannelRef = useRef<ReturnType<typeof subscribeToListItems>>(null);
  const listChannelRef = useRef<ReturnType<typeof subscribeToListMetadata>>(null);

  const session = useRef(0)
  const latestRead = useRef(0)
  const revision = useRef(0)

  // Optimistic updates: apply change to local state immediately
  const updateOptimistically = useCallback((item: Item) => {
    revision.current++
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

  // A realtime event may arrive before the receipt, including a partner's newer edit.
  const appendImported = useCallback((saved: Item[]) => {
    revision.current++
    setItems(current => {
      const known = new Set(current.map(item => item.id))
      return [...current, ...saved.filter(item => !known.has(item.id))]
    })
  }, [])

  // Optimistic delete: remove item from local state immediately
  const deleteOptimistically = useCallback((itemId: string) => {
    revision.current++
    setItems((prev) => prev.filter((i) => i.id !== itemId));
  }, []);

  // Optimistic reorder: reorder items to match given ID order
  const reorderOptimistically = useCallback((orderedIds: string[]) => {
    revision.current++
    setItems((prev) => {
      const itemMap = new Map(prev.map((item) => [item.id, item]));
      const reordered = orderedIds
        .map((id) => itemMap.get(id))
        .filter((item) => item !== undefined) as Item[];
      return reordered;
    });
  }, []);

  const readItems = useCallback(async () => {
    const generation = session.current
    const request = ++latestRead.current
    // If a change arrives during the snapshot, read again before replacing newer state.
    while (session.current === generation && latestRead.current === request) {
      const atStart = revision.current
      const { data, error } = await supabase.from('items').select('*')
        .eq('list_id', listId).order('order_index', { ascending: true })
      if (error) throw new Error(error.message)
      if (session.current !== generation || latestRead.current !== request) return
      if (atStart === revision.current) {
        setItems(data ?? [])
        return
      }
    }
  }, [listId])

  const fetchList = useCallback(async () => {
    const generation = session.current
    try {
      if (!listId) throw new Error('List ID is required')
      setLoading(true)
      setError(null)
      const { data, error } = await supabase.from('lists').select('*').eq('id', listId).single()
      if (session.current !== generation) return
      if (error) throw new Error(error.message)
      setList(data)
      await readItems()
    } catch (e) {
      if (session.current === generation) setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      if (session.current === generation) setLoading(false)
    }
  }, [listId, readItems])

  // Handle realtime item changes
  const handleItemsChange = useCallback(
    (payload: RealtimePostgresChangesPayload<Item>) => {
      revision.current++
      if (payload.eventType === 'INSERT') {
        setItems((prev) => {
          // Skip if item already exists (e.g., from optimistic update)
          if (prev.some((i) => i.id === payload.new.id)) return prev;
          return [...prev, payload.new];
        });
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
    const generation = ++session.current
    void fetchList()
    const catchUp = () => {
      if (session.current === generation) void readItems().catch(() => {})
    }
    async function subscribe() {
      // The initial channel join must carry the member JWT for filtered Postgres changes.
      await supabase.realtime.setAuth().catch(() => undefined)
      if (session.current !== generation) return
      itemsChannelRef.current = subscribeToListItems(listId, handleItemsChange, catchUp)
      listChannelRef.current = subscribeToListMetadata(listId, handleListChange)
    }
    const onResume = () => {
      if (document.visibilityState === 'visible') catchUp()
    }
    if (listId) {
      void subscribe()
      window.addEventListener('online', catchUp)
      document.addEventListener('visibilitychange', onResume)
    }

    // Cleanup subscriptions on unmount
    return () => {
      session.current++
      window.removeEventListener('online', catchUp)
      document.removeEventListener('visibilitychange', onResume)
      if (itemsChannelRef.current) {
        unsubscribeFromChannel(itemsChannelRef.current);
      }
      if (listChannelRef.current) {
        unsubscribeFromChannel(listChannelRef.current);
      }
    };
  }, [listId, fetchList, readItems, handleItemsChange, handleListChange]);

  const refetch = useCallback(async () => {
    await fetchList();
  }, [fetchList]);

  return {
    list,
    items,
    loading,
    error,
    refetch,
    appendImported,
    updateOptimistically,
    deleteOptimistically,
    reorderOptimistically,
  };
}
