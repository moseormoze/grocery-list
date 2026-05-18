'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getOfflineQueue, NetworkSimulator, type QueuedMutation } from '@/lib/offline/queue';
import { replayOfflineMutations, type SyncResult } from '@/lib/supabase/sync';

export interface UseOfflineQueueState {
  isOnline: boolean;
  queue: QueuedMutation[];
  syncing: boolean;
  syncError: string | null;
  unsyncedCount: number;
}

/**
 * Hook for managing offline state and mutation queue.
 * Automatically detects connectivity and replays mutations.
 */
export function useOfflineQueue(): UseOfflineQueueState {
  const [isOnline, setIsOnline] = useState(true);
  const [queue, setQueue] = useState<QueuedMutation[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const simulatorRef = useRef<NetworkSimulator | null>(null);
  const unsubscribeRef = useRef<() => void>(() => {});

  const unsyncedCount = queue.filter((m) => !m.synced).length;

  // Handle connection restored
  const handleGoOnline = useCallback(async () => {
    setIsOnline(true);
    setSyncError(null);

    // Replay queued mutations
    if (unsyncedCount > 0) {
      setSyncing(true);
      try {
        const result = await replayOfflineMutations();
        if (!result.success && result.errors.length > 0) {
          setSyncError(result.errors[0]);
        }
      } catch (e) {
        const error = e instanceof Error ? e.message : 'Sync failed';
        setSyncError(error);
      } finally {
        setSyncing(false);
      }
    }
  }, [unsyncedCount]);

  // Listen to network changes
  useEffect(() => {
    const offlineQueue = getOfflineQueue();

    // Subscribe to queue changes
    unsubscribeRef.current = offlineQueue.subscribe((newQueue) => {
      setQueue(newQueue);
    });

    // For now, use navigator.onLine + native events
    // (NetworkSimulator is available for testing)
    const handleOnline = () => handleGoOnline();
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial state
    setIsOnline(navigator.onLine);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribeRef.current?.();
    };
  }, [handleGoOnline]);

  return {
    isOnline,
    queue,
    syncing,
    syncError,
    unsyncedCount,
  };
}

/**
 * For testing: create a simulator to control offline/online state.
 */
export function createNetworkSimulator(): NetworkSimulator {
  return new NetworkSimulator();
}
