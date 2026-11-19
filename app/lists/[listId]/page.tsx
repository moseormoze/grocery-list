'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useList } from '@/hooks/useList';
import type { Item } from '@/lib/db/types';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { ArrowRight } from 'lucide-react';
import { EmojiIcon } from '@/lib/icon-map';
import { SECTIONS_BY_TYPE } from '@/lib/categories';
import { LIST_TYPE_META } from '@/lib/list-types';
import { getProgressLabel, shouldShowCompleteTrip } from '@/lib/list-progress';
import { formatCopyList } from '@/lib/copy-list';
import { CopyListButton } from './CopyListButton';
import { ItemEditor } from '@/components/ItemEditor';
import { SortableGroceryItem } from '@/components/SortableGroceryItem';
import { isAutoSuccess, type SaveResult } from '@/lib/categorization/types';
import messages from '@/messages/he.json';

export default function ListDetailPage() {
  const router = useRouter();
  const params = useParams();
  const listId = params?.listId as string;

  const { list, items, loading, error, updateOptimistically, deleteOptimistically, reorderOptimistically } = useList(listId);
  const [mode, setMode] = useState<'browse' | 'edit'>('browse');
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [effects, setEffects] = useState<Record<string, number>>({});
  const [announcement, setAnnouncement] = useState({ text: '', sequence: 0 });
  const [showConfirmTrip, setShowConfirmTrip] = useState(false);
  const [swipedItemId, setSwipedItemId] = useState<string | null>(null);
  const touchStartRef = useRef(0);
  const touchEndRef = useRef(0);

  const sensors = useSensors(
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    const deadlines = Object.values(effects);
    if (!deadlines.length) return;
    const timer = setTimeout(() => {
      setEffects(current => Object.fromEntries(Object.entries(current).filter(([, deadline]) => deadline > Date.now())));
    }, Math.max(0, Math.min(...deadlines) - Date.now()));
    return () => clearTimeout(timer);
  }, [effects]);

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="text-center">טוען...</div>
      </div>
    );
  }

  if (error || !list) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="text-center text-danger">שגיאה: {error}</div>
      </div>
    );
  }

  const typeInfo = LIST_TYPE_META[list.type];
  const tickedCount = items.filter((i) => i.ticked).length;
  const totalCount = items.length;
  const showCompleteTrip = shouldShowCompleteTrip(list.type, tickedCount);

  const onItemSaved = (result: SaveResult) => {
    updateOptimistically(result.item);
    if (isAutoSuccess(result.source)) {
      setEffects(current => ({ ...current, [result.item.id]: Date.now() + 500 }));
      const category = SECTIONS_BY_TYPE.supermarket[result.item.section_id || 'other'];
      setAnnouncement(current => ({
        text: messages.items.categorized.replace('{itemName}', result.item.name).replace('{categoryName}', category?.name ?? ''),
        sequence: current.sequence + 1,
      }));
    }
  };

  const handleTickItem = async (item: Item) => {
    const updated = { ...item, ticked: !item.ticked };
    updateOptimistically(updated);

    await supabase
      .from('items')
      .update({ ticked: !item.ticked, updated_at: new Date().toISOString() })
      .eq('id', item.id);
  };

  const handleDeleteItem = async (item: Item) => {
    deleteOptimistically(item.id);
    await supabase.from('items').delete().eq('id', item.id);
  };

  const handleCompleteTrip = async () => {
    const tickedItems = items.filter((i) => i.ticked);
    const itemIds = tickedItems.map((i) => i.id);

    // Optimistically remove ticked items from state
    itemIds.forEach((id) => deleteOptimistically(id));

    await supabase.from('list_snapshots').insert({
      list_id: listId,
      items_snapshot: tickedItems,
      created_at: new Date().toISOString(),
    });

    await supabase.from('items').delete().in('id', itemIds);

    setShowConfirmTrip(false);
  };

  const groupedItems = items.reduce((acc, item) => {
    const section = item.section_id || 'other';
    if (!acc[section]) acc[section] = [];
    acc[section].push(item);
    return acc;
  }, {} as Record<string, Item[]>);


  return (
    <div className="min-h-screen bg-cream pb-32 flex flex-col">
      {/* Top Bar */}
      <div className="copy-list-header px-4 py-3 bg-cream border-b border-ink-06">
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.back()}
            className="icon-btn text-xl flex-shrink-0"
          >
            <ArrowRight />
          </button>
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center text-lg flex-shrink-0"
            style={{ background: typeInfo.tint }}
          >
            <EmojiIcon emoji={typeInfo.emoji} />
          </div>
          <div className="flex-1 min-w-0 flex flex-col">
            <div className="font-bold text-base truncate">{list.name}</div>
            <div className="text-xs text-ink-50">{typeInfo.label} · משותפת</div>
          </div>
          {list.type === 'supermarket' && (
            <CopyListButton key={listId} text={formatCopyList(Object.values(groupedItems).flat())} />
          )}
          <button
            onClick={() => setMode(mode === 'browse' ? 'edit' : 'browse')}
            className="btn btn-soft text-sm px-4 flex-shrink-0"
          >
            {mode === 'edit' ? 'בוצע' : 'ערוך'}
          </button>
        </div>
      </div>

      {/* Progress Strip */}
      {totalCount > 0 && mode === 'browse' && (
        <div className="px-6 py-3 flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <div className="text-xs font-bold text-ink-70">
              {getProgressLabel(list.type, tickedCount, totalCount)}
            </div>
            {totalCount > 0 && (
              <div className="text-xs font-bold">
                <span className="ltr">{tickedCount} מתוך {totalCount}</span>
                <span className="text-ink-50 font-medium"> פריטים</span>
              </div>
            )}
          </div>
          {totalCount > 0 && (
            <div className="h-2 rounded-full bg-ink-06 overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-all"
                style={{ width: `${totalCount ? (tickedCount / totalCount) * 100 : 0}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* Items */}
      <div className="flex-1 px-4 py-2">
        {totalCount === 0 && mode === 'browse' ? (
          <div className="flex flex-col items-center justify-center gap-6 py-20 text-center">
            <div className="text-5xl">
              <EmojiIcon emoji="📝" />
            </div>
            <div className="flex flex-col gap-2">
              <h2 className="text-lg font-bold">רשימה ריקה</h2>
              <p className="text-xs text-ink-70">{messages.items.emptyListDescription}</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {Object.entries(groupedItems).map(([section, sectionItems]) => {
              if (sectionItems.length === 0) return null;
              const sectionInfo = SECTIONS_BY_TYPE[list.type][section] || SECTIONS_BY_TYPE[list.type].other;

              const handleDragEnd = async (event: DragEndEvent) => {
                const { active, over } = event;
                if (!over || active.id === over.id) return;

                const oldIndex = sectionItems.findIndex((i) => i.id === active.id);
                const newIndex = sectionItems.findIndex((i) => i.id === over.id);

                if (oldIndex === -1 || newIndex === -1) return;

                const reorderedItems = arrayMove(sectionItems, oldIndex, newIndex);
                const reorderedIds = reorderedItems.map((i) => i.id);

                reorderOptimistically(reorderedIds);

                const updates = reorderedItems.map((item, idx) => ({
                  id: item.id,
                  order_index: items.findIndex((i) => i.id === reorderedIds[idx]),
                }));

                await Promise.all(
                  updates.map((update) =>
                    supabase
                      .from('items')
                      .update({ order_index: update.order_index })
                      .eq('id', update.id)
                  )
                );
              };

              return (
                <div key={section} className="flex flex-col gap-2">
                  {/* Section Banner */}
                  <div
                    className="rounded-2xl p-5 flex items-center justify-between overflow-hidden relative"
                    style={{
                      background: sectionInfo.tint,
                      backgroundImage: `linear-gradient(115deg, transparent 60%, rgba(255,255,255,.35) 62%, transparent 64%)`,
                    }}
                  >
                    <div
                      className="font-bold text-base"
                      style={{ color: sectionInfo.ink }}
                    >
                      {sectionInfo.name}
                    </div>
                    <div className="text-3xl flex items-center justify-center" style={{ transform: 'translateY(2px) rotate(-6deg)', width: '36px', height: '36px' }}>
                      <EmojiIcon emoji={sectionInfo.emoji} />
                    </div>
                  </div>

                  {/* Section Items with DnD */}
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext
                      items={sectionItems.map((i) => i.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="flex flex-col">
                        {sectionItems.map((item) => {
                          const isSwipped = swipedItemId === item.id;

                          const handleTouchStart = (e: React.TouchEvent) => {
                            touchStartRef.current = e.changedTouches[0].clientX;
                          };

                          const handleTouchEnd = (e: React.TouchEvent) => {
                            touchEndRef.current = e.changedTouches[0].clientX;
                            const distance = touchStartRef.current - touchEndRef.current;
                            if (distance > 50) {
                              setSwipedItemId(item.id);
                            }
                            touchStartRef.current = 0;
                            touchEndRef.current = 0;
                          };

                          return (
                            <SortableGroceryItem
                              key={item.id}
                              item={item}
                              mode={mode}
                              effectUntil={effects[item.id]}
                              onEdit={value => { setEditingItem(value); setShowAddSheet(true); }}
                              onDelete={handleDeleteItem}
                              onToggle={handleTickItem}
                              onSwipeHandled={() => setSwipedItemId(null)}
                              isSwipped={isSwipped}
                              handleTouchStart={handleTouchStart}
                              handleTouchEnd={handleTouchEnd}
                            />
                          );
                        })}
                      </div>
                    </SortableContext>
                  </DndContext>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating Buttons */}
      <div className="fixed bottom-5 inset-x-4 flex flex-col gap-2">
        {showCompleteTrip && mode === 'browse' && (
          <button
            onClick={() => setShowConfirmTrip(true)}
            className="btn btn-primary w-full"
          >
            סיימתי קניות · {tickedCount}
          </button>
        )}
        <button
          onClick={() => {
            setEditingItem(null);
            setShowAddSheet(true);
          }}
          className={`btn w-full ${showCompleteTrip && mode === 'browse' ? 'btn-soft' : 'btn-accent'}`}
        >
          + הוסף פריט
        </button>
      </div>

      <div role="status" aria-live="polite" className="sr-only">
        <span key={announcement.sequence}>{announcement.text}</span>
      </div>
      {showAddSheet && (
        <ItemEditor key={editingItem?.id ?? 'new'} listId={listId} listType={list.type}
          item={editingItem} orderIndex={items.length} onSaved={onItemSaved}
          onClose={() => { setShowAddSheet(false); setEditingItem(null); }} />
      )}

      {/* Confirm Trip Modal */}
      {showConfirmTrip && (
        <div className="fixed inset-0 bg-black/45 flex items-center justify-center z-60">
          <div className="bg-cream rounded-2xl p-6 max-w-sm w-4/5 shadow-modal">
            <h2 className="text-lg font-bold mb-2">סיימתי את הקניות?</h2>
            <p className="text-sm text-ink-70 mb-6">
              {tickedCount} פריטים שסומנו יוסרו מהרשימה. המשך?
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleCompleteTrip}
                className="flex-1 btn btn-accent"
              >
                כן, סיימתי
              </button>
              <button
                onClick={() => setShowConfirmTrip(false)}
                className="flex-1 btn btn-soft"
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
