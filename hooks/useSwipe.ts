import { useRef, useCallback } from 'react';

interface SwipeOptions {
  threshold?: number;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
}

export function useSwipe({ threshold = 50, onSwipeLeft, onSwipeRight }: SwipeOptions) {
  const touchStartRef = useRef(0);
  const touchEndRef = useRef(0);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartRef.current = e.changedTouches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    touchEndRef.current = e.changedTouches[0].clientX;
    handleSwipe();
  }, [onSwipeLeft, onSwipeRight]);

  const handleSwipe = useCallback(() => {
    if (!touchStartRef.current || !touchEndRef.current) return;

    const distance = touchStartRef.current - touchEndRef.current;
    const isLeftSwipe = distance > threshold;
    const isRightSwipe = distance < -threshold;

    if (isLeftSwipe) {
      onSwipeLeft?.();
    } else if (isRightSwipe) {
      onSwipeRight?.();
    }

    touchStartRef.current = 0;
    touchEndRef.current = 0;
  }, [threshold, onSwipeLeft, onSwipeRight]);

  return { handleTouchStart, handleTouchEnd };
}
