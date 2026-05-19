'use client';

import { useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useList } from '@/hooks/useList';
import type { Item } from '@/lib/db/types';

const listTypeNames: Record<'supermarket' | 'pharmacy' | 'house', { label: string; emoji: string; tint: string }> = {
  supermarket: { label: 'סופר', emoji: '🛒', tint: '#FBE5DC' },
  pharmacy: { label: 'פארם', emoji: '💊', tint: '#E4EEF3' },
  house: { label: 'בית', emoji: '🏠', tint: '#F2E9D5' },
};

const PLACEHOLDERS_BY_TYPE: Record<'supermarket' | 'pharmacy' | 'house', { itemName: string; itemQty: string }> = {
  supermarket: { itemName: 'למשל: עגבניות', itemQty: 'למשל: 1 ק״ג' },
  pharmacy: { itemName: 'למשל: משחת שיניים', itemQty: 'למשל: 1 יחידה' },
  house: { itemName: 'למשל: צבע לקירות', itemQty: 'למשל: 2 ליטר' },
};

const SECTIONS_BY_TYPE: Record<'supermarket' | 'pharmacy' | 'house', Record<string, { name: string; emoji: string; tint: string; ink: string }>> = {
  supermarket: {
    produce: { name: 'ירקות ופירות', emoji: '🥬', tint: '#E8F1DD', ink: '#4F6E32' },
    milk: { name: 'מוצרי חלב', emoji: '🥛', tint: '#E7F1F7', ink: '#3B6C8C' },
    meat: { name: 'בשר ודגים', emoji: '🥩', tint: '#F6E0DA', ink: '#A0432F' },
    dry: { name: 'יבש', emoji: '🌾', tint: '#F2E9D5', ink: '#8A6A2B' },
    baking: { name: 'אפייה ומאפייה', emoji: '🧁', tint: '#F7E2E8', ink: '#A24566' },
    snacks: { name: 'חטיפים', emoji: '🍿', tint: '#FAE7CB', ink: '#A86220' },
    drinks: { name: 'משקאות', emoji: '🥤', tint: '#E6E2F0', ink: '#564B86' },
    frozen: { name: 'קפואים', emoji: '🧊', tint: '#E0EBF2', ink: '#3D6580' },
    cleaning: { name: 'ניקיון', emoji: '🧽', tint: '#DEEFEC', ink: '#3E7C76' },
    other: { name: 'אחר', emoji: '📦', tint: '#ECEAE5', ink: '#5A554B' },
  },
  pharmacy: {
    hygiene: { name: 'הגיינה', emoji: '🧼', tint: '#E8F1DD', ink: '#4F6E32' },
    cleaning: { name: 'מוצרי ניקוי', emoji: '🧽', tint: '#DEEFEC', ink: '#3E7C76' },
    cosmetics: { name: 'קוסמטיקה', emoji: '💅', tint: '#FAE7CB', ink: '#A86220' },
    paper: { name: 'מוצרי נייר', emoji: '🧻', tint: '#E0EBF2', ink: '#3D6580' },
    medicine_cabinet: { name: 'מזווה', emoji: '🏥', tint: '#F7E2E8', ink: '#A24566' },
    pharmacy_medicines: { name: 'בית מרקחת ותרופות', emoji: '💊', tint: '#E7F1F7', ink: '#3B6C8C' },
    other: { name: 'אחר', emoji: '📦', tint: '#ECEAE5', ink: '#5A554B' },
  },
  house: {
    cleaning: { name: 'ניקיון', emoji: '🧽', tint: '#DEEFEC', ink: '#3E7C76' },
    laundry: { name: 'כביסה', emoji: '👕', tint: '#E7F1F7', ink: '#3B6C8C' },
    furniture: { name: 'ריהוט', emoji: '🛋️', tint: '#F2E9D5', ink: '#8A6A2B' },
    decor: { name: 'עיצוב וקישוט', emoji: '🖼️', tint: '#F7E2E8', ink: '#A24566' },
    repairs: { name: 'תיקון וצביעה', emoji: '🔧', tint: '#F6E0DA', ink: '#A0432F' },
    tools: { name: 'כלים וחומרים', emoji: '🪛', tint: '#FAE7CB', ink: '#A86220' },
    other: { name: 'אחר', emoji: '📦', tint: '#ECEAE5', ink: '#5A554B' },
  },
};

export default function ListDetailPage() {
  const router = useRouter();
  const params = useParams();
  const listId = params?.listId as string;

  const { list, items, loading, error, updateOptimistically, deleteOptimistically } = useList(listId);
  const [mode, setMode] = useState<'browse' | 'edit'>('browse');
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [itemName, setItemName] = useState('');
  const [itemQty, setItemQty] = useState('');
  const [itemSection, setItemSection] = useState('other');
  const [showConfirmTrip, setShowConfirmTrip] = useState(false);
  const [swipedItemId, setSwipedItemId] = useState<string | null>(null);
  const touchStartRef = useRef(0);
  const touchEndRef = useRef(0);

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

  const typeInfo = listTypeNames[list.type];
  const tickedCount = items.filter((i) => i.ticked).length;
  const totalCount = items.length;

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!itemName.trim()) return;

    if (editingItem) {
      const { error: updateError } = await supabase
        .from('items')
        .update({
          name: itemName,
          qty: itemQty || null,
          section_id: itemSection,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingItem.id);

      if (!updateError) {
        const updated = {
          ...editingItem,
          name: itemName,
          qty: itemQty || undefined,
          section_id: itemSection,
          updated_at: new Date().toISOString(),
        };
        updateOptimistically(updated);
        setEditingItem(null);
        setItemName('');
        setItemQty('');
        setItemSection('other');
        setShowAddSheet(false);
      }
    } else {
      const newItem: Omit<Item, 'id' | 'created_at' | 'updated_at'> = {
        list_id: listId,
        name: itemName,
        qty: itemQty || undefined,
        section_id: itemSection,
        ticked: false,
        order_index: items.length,
        created_by_user_id: (await supabase.auth.getUser()).data.user?.id || '',
      };

      const { data: createdItem, error: insertError } = await supabase
        .from('items')
        .insert(newItem as any)
        .select()
        .single();

      if (!insertError && createdItem) {
        updateOptimistically(createdItem);
        setItemName('');
        setItemQty('');
        setItemSection('other');
        setShowAddSheet(false);
      }
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
      <div className="px-4 py-3 bg-cream border-b border-ink-06">
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.back()}
            className="icon-btn text-xl"
          >
            ‹
          </button>
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center text-lg flex-shrink-0"
            style={{ background: typeInfo.tint }}
          >
            {typeInfo.emoji}
          </div>
          <div className="flex-1 min-w-0 flex flex-col">
            <div className="font-bold text-base truncate">{list.name}</div>
            <div className="text-xs text-ink-50">{typeInfo.label} · משותפת</div>
          </div>
          <button
            onClick={() => setMode(mode === 'browse' ? 'edit' : 'browse')}
            className="btn btn-soft text-sm px-4"
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
              {totalCount === 0
                ? 'רשימה ריקה'
                : tickedCount === 0
                ? 'בואו נתחיל'
                : tickedCount === totalCount
                ? 'הכל בעגלה'
                : 'בעיצומה של הקניה'}
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
            <div className="text-5xl">📝</div>
            <div className="flex flex-col gap-2">
              <h2 className="text-lg font-bold">רשימה ריקה</h2>
              <p className="text-xs text-ink-70">התחילו בלחיצה על "+ הוסף פריט"</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {Object.entries(groupedItems).map(([section, sectionItems]) => {
              if (sectionItems.length === 0) return null;
              const sectionInfo = SECTIONS_BY_TYPE[list.type][section] || SECTIONS_BY_TYPE[list.type].other;

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
                    <div className="text-3xl" style={{ transform: 'translateY(2px) rotate(-6deg)' }}>
                      {sectionInfo.emoji}
                    </div>
                  </div>

                  {/* Section Items */}
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
                      <div
                        key={item.id}
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
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              <line x1="10" y1="11" x2="10" y2="17" />
                              <line x1="14" y1="11" x2="14" y2="17" />
                            </svg>
                            <span style={{ color: '#fff', fontSize: '14px', fontWeight: 700 }}>מחיקה</span>
                          </div>
                        )}

                        {/* Item row */}
                        <div
                          className="flex items-center gap-1 min-h-14 px-2 py-1 cursor-pointer border-b border-ink-06 last:border-b-0 transition-all bg-cream"
                          style={{
                            opacity: !mode && item.ticked ? 0.5 : 1,
                            backgroundColor: mode === 'edit' ? '#FBF8F1' : 'transparent',
                            borderRadius: mode === 'edit' ? '12px' : '0px',
                            transform: isSwipped ? 'translateX(110px)' : 'translateX(0)',
                            transition: 'transform 200ms',
                          }}
                          onClick={() => {
                            if (isSwipped) {
                              handleDeleteItem(item);
                              setSwipedItemId(null);
                              return;
                            }
                            if (mode === 'edit') {
                              setEditingItem(item);
                              setItemName(item.name);
                              setItemQty(item.qty || '');
                              setItemSection(item.section_id || 'other');
                              setShowAddSheet(true);
                            } else {
                              handleTickItem(item);
                            }
                          }}
                        >
                        {mode === 'edit' ? (
                          <div className="w-11 h-11 flex items-center justify-center flex-shrink-0 text-ink-30">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="9" cy="6" r="0.5" />
                              <circle cx="15" cy="6" r="0.5" />
                              <circle cx="9" cy="12" r="0.5" />
                              <circle cx="15" cy="12" r="0.5" />
                              <circle cx="9" cy="18" r="0.5" />
                              <circle cx="15" cy="18" r="0.5" />
                            </svg>
                          </div>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTickItem(item);
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
                              {item.ticked && (
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                              )}
                            </div>
                          </button>
                        )}

                        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                          <div
                            className="text-base font-semibold leading-snug transition-all"
                            style={{
                              textDecoration: item.ticked && mode !== 'edit' ? 'line-through' : 'none',
                              textDecorationThickness: '1.5px',
                              textDecorationColor: item.ticked ? 'rgba(28,27,23,0.5)' : 'transparent',
                              color: '#1C1B17',
                              transition: 'all 250ms',
                            }}
                            dir="auto"
                          >
                            {item.name}
                          </div>
                          {item.qty && (
                            <div
                              className="text-xs font-medium transition-all"
                              style={{
                                color: 'rgba(28,27,23,0.5)',
                                textDecoration: item.ticked && mode !== 'edit' ? 'line-through' : 'none',
                                transition: 'all 250ms',
                              }}
                              dir="auto"
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
                                setEditingItem(item);
                                setItemName(item.name);
                                setItemQty(item.qty || '');
                                setItemSection(item.section_id || 'other');
                                setShowAddSheet(true);
                              }}
                              className="icon-btn"
                            >
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M14.5 4.5l5 5L8 21H3v-5L14.5 4.5z" />
                                <path d="M13 6l5 5" />
                              </svg>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteItem(item);
                              }}
                              className="icon-btn danger"
                            >
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                <line x1="10" y1="11" x2="10" y2="17" />
                                <line x1="14" y1="11" x2="14" y2="17" />
                              </svg>
                            </button>
                          </div>
                        )}
                        </div>
                      </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating Buttons */}
      <div className="fixed bottom-5 inset-x-4 flex flex-col gap-2">
        {tickedCount > 0 && mode === 'browse' && (
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
            setItemName('');
            setItemQty('');
            setItemSection('other');
            setShowAddSheet(true);
          }}
          className={`btn w-full ${tickedCount > 0 && mode === 'browse' ? 'btn-soft' : 'btn-accent'}`}
        >
          + הוסף פריט
        </button>
      </div>

      {/* Add/Edit Modal */}
      {showAddSheet && (
        <div className="fixed inset-0 bg-black/40 flex items-end z-50">
          <div className="w-full bg-cream rounded-t-3xl shadow-sheet max-h-4/5 overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-ink-06 gap-2">
              <button
                onClick={() => setShowAddSheet(false)}
                className="btn btn-ghost text-sm"
              >
                ביטול
              </button>
              <h2 className="text-lg font-bold flex-1 text-center">{editingItem ? 'ערוך פריט' : 'הוסף פריט'}</h2>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  handleAddItem(new Event('submit') as any);
                }}
                className="btn btn-accent text-sm"
              >
                {editingItem ? 'עדכן' : 'הוסף'}
              </button>
            </div>

            <div className="p-6 flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-ink-70">שם הפריט</label>
                <input
                  type="text"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  placeholder={PLACEHOLDERS_BY_TYPE[list.type].itemName}
                  className="input"
                  autoFocus
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-ink-70">כמות (אופציונלי)</label>
                <input
                  type="text"
                  value={itemQty}
                  onChange={(e) => setItemQty(e.target.value)}
                  placeholder={PLACEHOLDERS_BY_TYPE[list.type].itemQty}
                  className="input"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-ink-70">קטגוריה</label>
                <select
                  value={itemSection}
                  onChange={(e) => setItemSection(e.target.value)}
                  className="input"
                >
                  {Object.entries(SECTIONS_BY_TYPE[list.type]).map(([key, section]) => (
                    <option key={key} value={key}>
                      {section.emoji} {section.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
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
