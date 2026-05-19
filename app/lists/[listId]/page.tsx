'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useList } from '@/hooks/useList';
import type { Item } from '@/lib/db/types';

const listTypeNames: Record<'supermarket' | 'pharmacy' | 'house', { label: string; emoji: string; tint: string }> = {
  supermarket: { label: 'סופר', emoji: '🛒', tint: '#FBE5DC' },
  pharmacy: { label: 'בית מרקחת', emoji: '💊', tint: '#E4EEF3' },
  house: { label: 'בית', emoji: '🏠', tint: '#F2E9D5' },
};

const SECTIONS: Record<string, { name: string; emoji: string; tint: string; ink: string }> = {
  produce: { name: 'ירקות ופירות', emoji: '🥬', tint: '#E8F1DD', ink: '#4F6E32' },
  milk: { name: 'מוצרי חלב', emoji: '🥛', tint: '#E7F1F7', ink: '#3B6C8C' },
  meat: { name: 'בשר ודגים', emoji: '🥩', tint: '#F6E0DA', ink: '#A0432F' },
  dry: { name: 'יבש', emoji: '🌾', tint: '#F2E9D5', ink: '#8A6A2B' },
  baking: { name: 'אפייה ומאפייה', emoji: '🧁', tint: '#F7E2E8', ink: '#A24566' },
  cleaning: { name: 'ניקיון', emoji: '🧽', tint: '#DEEFEC', ink: '#3E7C76' },
  snacks: { name: 'חטיפים', emoji: '🍿', tint: '#FAE7CB', ink: '#A86220' },
  drinks: { name: 'משקאות', emoji: '🥤', tint: '#E6E2F0', ink: '#564B86' },
  frozen: { name: 'קפואים', emoji: '🧊', tint: '#E0EBF2', ink: '#3D6580' },
  other: { name: 'אחר', emoji: '📦', tint: '#ECEAE5', ink: '#5A554B' },
};

export default function ListDetailPage() {
  const router = useRouter();
  const params = useParams();
  const listId = params?.listId as string;

  const { list, items, loading, error, updateOptimistically } = useList(listId);
  const [mode, setMode] = useState<'browse' | 'edit'>('browse');
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [itemName, setItemName] = useState('');
  const [itemQty, setItemQty] = useState('');
  const [itemSection, setItemSection] = useState('other');
  const [showConfirmTrip, setShowConfirmTrip] = useState(false);

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
    await supabase.from('items').delete().eq('id', item.id);
  };

  const handleCompleteTrip = async () => {
    const tickedItems = items.filter((i) => i.ticked);

    await supabase.from('list_snapshots').insert({
      list_id: listId,
      items_snapshot: tickedItems,
      created_at: new Date().toISOString(),
    });

    const itemIds = tickedItems.map((i) => i.id);
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
            className="w-11 h-11 rounded-lg border-0 bg-transparent cursor-pointer text-xl p-0 hover:bg-ink-06 transition-colors flex items-center justify-center"
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
            className="px-4 py-2 rounded-lg bg-ink-06 border-0 cursor-pointer text-sm font-semibold text-ink hover:bg-ink-10 transition-colors"
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
              const sectionInfo = SECTIONS[section] || SECTIONS.other;

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
                    {sectionItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex flex-row-reverse items-center gap-1 min-h-14 px-1.5 py-1 cursor-pointer border-b border-ink-06 last:border-b-0 rounded-lg transition-opacity"
                        style={{
                          opacity: !mode && item.ticked ? 0.5 : 1,
                        }}
                        onClick={() => {
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
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteItem(item);
                              }}
                              className="w-11 h-11 flex items-center justify-center bg-transparent border-0 cursor-pointer text-lg text-danger hover:bg-red-100 rounded transition-colors"
                            >
                              🗑️
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingItem(item);
                                setItemName(item.name);
                                setItemQty(item.qty || '');
                                setItemSection(item.section_id || 'other');
                                setShowAddSheet(true);
                              }}
                              className="w-11 h-11 flex items-center justify-center bg-transparent border-0 cursor-pointer text-lg text-ink-70 hover:bg-ink-06 rounded transition-colors"
                            >
                              ✏️
                            </button>
                            <div className="w-11 h-11 flex items-center justify-center text-ink-30 cursor-grab">
                              ⋮⋮
                            </div>
                          </>
                        ) : (
                          <input
                            type="checkbox"
                            checked={item.ticked}
                            onChange={() => handleTickItem(item)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-6 h-6 cursor-pointer accent-accent"
                          />
                        )}

                        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                          <div
                            className="text-base font-semibold leading-snug"
                            style={{
                              textDecoration: item.ticked && mode !== 'edit' ? 'line-through' : 'none',
                              textDecorationThickness: '1.5px',
                              textDecorationColor: item.ticked ? '#1C1B17' : 'transparent',
                              color: '#1C1B17',
                            }}
                            dir="auto"
                          >
                            {item.name}
                          </div>
                          {item.qty && (
                            <div
                              className="text-xs text-ink-50 font-medium"
                              style={{
                                textDecoration: item.ticked && mode !== 'edit' ? 'line-through' : 'none',
                              }}
                              dir="auto"
                            >
                              {item.qty}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating Buttons */}
      <div className="fixed bottom-5 inset-x-4 flex gap-2">
        <button
          onClick={() => {
            setEditingItem(null);
            setItemName('');
            setItemQty('');
            setItemSection('other');
            setShowAddSheet(true);
          }}
          className="flex-1 py-3 bg-accent text-ink border-0 rounded-full font-bold text-base cursor-pointer hover:bg-accent-dark transition-colors"
        >
          + הוסף פריט
        </button>
        {tickedCount > 0 && mode === 'browse' && (
          <button
            onClick={() => setShowConfirmTrip(true)}
            className="flex-1 py-3 bg-yellow-500 text-ink border-0 rounded-full font-bold text-base cursor-pointer hover:bg-yellow-600 transition-colors"
          >
            סיימתי קניות
          </button>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showAddSheet && (
        <div className="fixed inset-0 bg-black/40 flex items-end z-50">
          <div className="w-full bg-cream rounded-t-3xl shadow-sheet max-h-4/5 overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-ink-06">
              <button
                onClick={() => setShowAddSheet(false)}
                className="bg-transparent border-0 font-inherit text-base text-ink-70 p-3 cursor-pointer hover:bg-ink-06 rounded transition-colors"
              >
                ביטול
              </button>
              <h2 className="text-lg font-bold">{editingItem ? 'ערוך פריט' : 'הוסף פריט'}</h2>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  handleAddItem(new Event('submit') as any);
                }}
                className="bg-transparent border-0 font-bold text-base text-accent-dark p-3 cursor-pointer hover:bg-accent-bg rounded transition-colors"
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
                  placeholder="למשל: עגבניות"
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
                  placeholder="למשל: 1 ק״ג"
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
                  {Object.entries(SECTIONS).map(([key, section]) => (
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
                className="flex-1 py-3 bg-accent text-ink border-0 rounded-full cursor-pointer font-bold hover:bg-accent-dark transition-colors"
              >
                כן, סיימתי
              </button>
              <button
                onClick={() => setShowConfirmTrip(false)}
                className="flex-1 py-3 bg-ink-06 text-ink border-0 rounded-full cursor-pointer font-bold hover:bg-ink-10 transition-colors"
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
