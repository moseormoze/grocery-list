'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Pencil, Trash2, Check } from 'lucide-react'
import type { Item } from '@/lib/db/types'
import { CategorySwish } from './CategorySwish'
import messages from '@/messages/he.json'

type Props = {
  item: Item, mode: 'browse' | 'edit', isSwipped: boolean, effectUntil?: number,
  handleTouchStart: (event: React.TouchEvent) => void, handleTouchEnd: (event: React.TouchEvent) => void,
  onEdit: (item: Item) => void, onDelete: (item: Item) => void, onToggle: (item: Item) => void, onSwipeHandled: () => void,
}
export function SortableGroceryItem({ item, mode, isSwipped, effectUntil, handleTouchStart, handleTouchEnd, onEdit, onDelete, onToggle, onSwipeHandled }: Props) {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: item.id, disabled: mode !== 'edit' });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
    };

    return (
      <div
        ref={setNodeRef}
        style={style}
        className="relative overflow-hidden rounded-lg"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Swipe-to-delete panel */}
        {isSwipped && mode === 'browse' && (
          <div
            className="absolute inset-0 flex items-center justify-center gap-2 px-4"
            style={{
              background: '#B14A33',
              zIndex: 10,
              width: '110px',
              right: 0,
            }}
          >
            <Trash2 size={18} color="#fff" />
            <span style={{ color: '#fff', fontSize: '14px', fontWeight: 700 }}>{messages.items.delete}</span>
          </div>
        )}

        {/* Item row */}
        <div
          className={`relative item-row ${mode === 'edit' ? 'item-row edit-mode' : ''} ${
            item.ticked ? 'item-row ticked' : ''
          } ${isDragging ? 'item-row dragging' : ''}`}
          style={{
            transform: isSwipped ? 'translateX(110px)' : 'translateX(0)',
            transition: 'transform 200ms',
          }}
          onClick={() => {
            if (isSwipped) {
              onDelete(item);
              onSwipeHandled();
              return;
            }
            if (mode === 'edit') {
              onEdit(item);
            } else {
              onToggle(item);
            }
          }}
        >
          {effectUntil !== undefined && <CategorySwish key={effectUntil} expiresAt={effectUntil} />}
          {mode === 'edit' ? (
            <div
              className="w-11 h-11 flex items-center justify-center flex-shrink-0 text-ink-30 cursor-grab active:cursor-grabbing"
              {...attributes}
              {...listeners}
            >
              <GripVertical size={20} />
            </div>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggle(item);
              }}
              className="w-11 h-11 flex items-center justify-center flex-shrink-0 bg-transparent border-0 cursor-pointer p-0 transition-all"
              style={{
                borderRadius: '50%',
              }}
            >
              <div
                className="w-26 h-26 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all"
                style={{
                  width: '26px',
                  height: '26px',
                  borderColor: item.ticked ? '#F4B5A0' : 'rgba(28,27,23,0.3)',
                  background: item.ticked ? '#F4B5A0' : 'transparent',
                  borderWidth: '1.8px',
                }}
              >
                {item.ticked && <Check size={14} color="#fff" strokeWidth={3} />}
              </div>
            </button>
          )}

          <div className="flex-1 min-w-0 flex flex-col gap-0.5">
            <div
              className={`item-name ${item.ticked ? 'ticked' : ''}`}
              dir="auto"
            >
              {item.name}
            </div>
            {item.qty && (
              <div
                className={`item-qty ${item.ticked ? 'ticked' : ''}`}
                dir="rtl"
              >
                {item.qty}
              </div>
            )}
          </div>

          {mode === 'edit' && (
            <div className="flex items-center gap-0 flex-shrink-0">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(item);
                }}
                className="icon-btn" aria-label={messages.items.editItem}
              >
                <Pencil size={18} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(item);
                }}
                className="icon-btn danger" aria-label={messages.items.delete}
              >
                <Trash2 size={18} />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }
