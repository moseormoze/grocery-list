'use client';

import { useState, useRef } from 'react';
import { ChevronLeft, Trash2 } from 'lucide-react';
import { EmojiIcon } from '@/lib/icon-map';
import type { ListWithProgress } from '@/lib/db/types';
import { LIST_TYPE_META, type ListType } from '@/lib/list-types';
import { getProgressLabel } from '@/lib/list-progress';

const COMMIT_THRESHOLD = 150;

function ProgressBadge({ type, ticked, total }: { type: ListType; ticked: number; total: number }) {
  if (total === 0) {
    return <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-ink-06 text-ink-70">ריקה</span>;
  }
  if (ticked === 0) {
    return <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-ink-06 text-ink-70">{total} פריטים</span>;
  }
  if (ticked === total) {
    return <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold" style={{ background: '#EDF2E8', color: '#46613F' }}>{getProgressLabel(type, ticked, total)}</span>;
  }
  return (
    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-accent-bg text-accent-dark">
      <span className="w-1.5 h-1.5 rounded-full bg-accent-dark" />
      <span className="ltr">{ticked} מתוך {total}</span>
    </span>
  );
}

export function ListCard({ list, onOpen, ticked, total, onDelete }: { list: ListWithProgress; onOpen: () => void; ticked: number; total: number; onDelete: () => void }) {
  const type = LIST_TYPE_META[list.type];
  const pct = total ? Math.round((ticked / total) * 100) : 0;
  const [swipeX, setSwipeX] = useState(0);
  const [isPressed, setIsPressed] = useState(false);
  const startX = useRef(0);
  const startSwipeX = useRef(0);
  const startTime = useRef(0);
  const isDragging = useRef(false);
  const justFinishedDrag = useRef(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startSwipeX.current = swipeX;
    startTime.current = Date.now();
    isDragging.current = false;
    setIsPressed(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const currentX = e.touches[0].clientX;
    const diff = currentX - startX.current;

    if (Math.abs(diff) > 5) {
      isDragging.current = true;
      setIsPressed(false);
    }

    if (isDragging.current) {
      const target = startSwipeX.current + diff;
      let next: number;
      if (target <= 0) {
        next = 0;
      } else if (target <= 120) {
        next = target;
      } else {
        // Rubber-band: each pixel past 120 contributes 0.3, capped at 180.
        next = Math.min(120 + (target - 120) * 0.3, 180);
      }
      setSwipeX(next);
    }
  };

  const handleTouchEnd = () => {
    if (swipeX >= COMMIT_THRESHOLD) {
      // Full-swipe commit: fire onDelete immediately, no second tap needed.
      // Per design option 3, leave swipeX at its current value; the modal
      // takes over the UI and a tap on the card body closes the swipe if
      // the user cancels.
      onDelete();
      justFinishedDrag.current = true;
      setTimeout(() => {
        justFinishedDrag.current = false;
      }, 200);
      isDragging.current = false;
      setIsPressed(false);
      return;
    }

    const timeDiff = Date.now() - startTime.current;
    const velocity = swipeX / timeDiff;

    const shouldOpen = velocity > 0.5 || swipeX > 60;

    if (shouldOpen) {
      setSwipeX(120);
    } else {
      setSwipeX(0);
    }

    if (isDragging.current) {
      justFinishedDrag.current = true;
      setTimeout(() => {
        justFinishedDrag.current = false;
      }, 200);
    }
    isDragging.current = false;
    setIsPressed(false);
  };

  const handleCardClick = () => {
    if (justFinishedDrag.current) return;
    if (swipeX > 0) {
      setSwipeX(0);
      return;
    }
    onOpen();
  };

  return (
    <div
      className="relative overflow-hidden rounded-xl"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Red delete background (revealed when card slides right) */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="absolute inset-y-0 left-0 flex items-center justify-center transition-all"
        style={{
          width: `${Math.max(swipeX, 0)}px`,
          opacity: swipeX > 0 ? 1 : 0,
          pointerEvents: swipeX >= 120 ? 'auto' : 'none',
          // red-600 once past the commit threshold, red-500 below.
          backgroundColor: swipeX >= COMMIT_THRESHOLD ? '#dc2626' : '#ef4444',
        }}
      >
        {swipeX >= 60 && <Trash2 size={24} className="text-white" />}
      </button>

      {/* Card content */}
      <button
        onClick={handleCardClick}
        className="relative w-full bg-surface rounded-xl p-4 border-0 cursor-pointer shadow-card text-right flex flex-col gap-3 font-inherit text-inherit color-inherit"
        style={{
          transform: `translateX(${swipeX}px)${isPressed ? ' scale(0.965)' : ''}`,
          backgroundColor: isPressed ? 'rgba(28,27,23,0.06)' : undefined,
          transition: isDragging.current
            ? 'none'
            : 'transform 250ms cubic-bezier(0.34, 1.56, 0.64, 1), background-color 120ms ease-out',
        }}
      >
        <div className="flex items-start gap-3">
          <div
            className="w-14 h-14 rounded-lg flex items-center justify-center text-2xl flex-shrink-0"
            style={{ background: type.tint }}
          >
            <EmojiIcon emoji={type.emoji} />
          </div>
          <div className="flex-1 min-w-0 flex flex-col gap-1.5">
            <div className="text-lg font-bold leading-tight truncate">{list.name}</div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold"
                style={{ background: type.tint, color: '#1C1B17' }}
              >
                <EmojiIcon emoji={type.emoji} />
                {type.label}
              </span>
              <ProgressBadge type={list.type} ticked={ticked} total={total} />
            </div>
            <div className="text-xs font-medium text-ink-50">{list.created_at ? new Date(list.created_at).toLocaleDateString('he-IL') : 'חדש'}</div>
          </div>
          <div className="text-ink-30 mt-3">
            <ChevronLeft size={20} />
          </div>
        </div>
        {total > 0 && ticked > 0 && (
          <div className="h-1 rounded-full bg-ink-06 overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
      </button>
    </div>
  );
}
