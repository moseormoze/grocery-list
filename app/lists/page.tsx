'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import type { List } from '@/lib/db/types';
import { EmojiIcon } from '@/lib/icon-map';
import { Settings, ChevronLeft, Trash2 } from 'lucide-react';

const listTypeNames: Record<'supermarket' | 'pharmacy' | 'house', { label: string; emoji: string; tint: string }> = {
  supermarket: { label: 'סופר', emoji: '🛒', tint: '#FBE5DC' },
  pharmacy: { label: 'פארם', emoji: '💊', tint: '#E4EEF3' },
  house: { label: 'בית', emoji: '🏠', tint: '#F2E9D5' },
};

interface ListWithProgress extends List {
  tickedCount?: number;
  totalCount?: number;
}

function MemberDot({ bg, emoji }: { bg: string; emoji: string }) {
  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center text-base"
      style={{ background: bg, boxShadow: '0 0 0 2.5px #fff' }}
    >
      {emoji}
    </div>
  );
}

function ProgressBadge({ ticked, total }: { ticked: number; total: number }) {
  if (total === 0) {
    return <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-ink-06 text-ink-70">ריקה</span>;
  }
  if (ticked === 0) {
    return <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-ink-06 text-ink-70">{total} פריטים</span>;
  }
  if (ticked === total) {
    return <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold" style={{ background: '#EDF2E8', color: '#46613F' }}>הכל בעגלה</span>;
  }
  return (
    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-accent-bg text-accent-dark">
      <span className="w-1.5 h-1.5 rounded-full bg-accent-dark" />
      <span className="ltr">{ticked} מתוך {total}</span>
    </span>
  );
}

function ListCard({ list, onOpen, ticked, total, onDelete }: { list: ListWithProgress; onOpen: () => void; ticked: number; total: number; onDelete: () => void }) {
  const type = listTypeNames[list.type];
  const pct = total ? Math.round((ticked / total) * 100) : 0;
  const [swipeX, setSwipeX] = useState(0);
  const startX = useRef(0);
  const startTime = useRef(0);
  const isDragging = useRef(false);
  const justFinishedDrag = useRef(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startTime.current = Date.now();
    isDragging.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const currentX = e.touches[0].clientX;
    const diff = currentX - startX.current;

    if (Math.abs(diff) > 5) {
      isDragging.current = true;
    }

    if (isDragging.current) {
      // Allow swipe in both directions from any position
      const newX = swipeX === 120 ? 120 + diff : diff;
      setSwipeX(Math.max(0, Math.min(newX, 120)));
    }
  };

  const handleTouchEnd = () => {
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
        className="absolute inset-y-0 left-0 flex items-center justify-center bg-red-500 transition-opacity"
        style={{
          width: `${Math.max(swipeX, 0)}px`,
          opacity: swipeX > 0 ? 1 : 0,
          pointerEvents: swipeX >= 120 ? 'auto' : 'none',
        }}
      >
        {swipeX >= 60 && <Trash2 size={24} className="text-white" />}
      </button>

      {/* Card content */}
      <button
        onClick={handleCardClick}
        className="relative w-full bg-surface rounded-xl p-4 border-0 cursor-pointer shadow-card text-right flex flex-col gap-3 font-inherit text-inherit color-inherit"
        style={{
          transform: `translateX(${swipeX}px)`,
          transition: isDragging.current ? 'none' : 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
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
              <ProgressBadge ticked={ticked} total={total} />
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

function CreateListButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full bg-transparent rounded-xl p-4 border-2 border-dashed border-ink-10 cursor-pointer hover:border-accent transition-colors flex items-center gap-3 font-inherit text-inherit"
    >
      <div className="w-14 h-14 rounded-lg bg-accent-bg flex items-center justify-center text-2xl flex-shrink-0">
        +
      </div>
      <div className="flex-1 text-right">
        <div className="font-bold text-lg">צור רשימה חדשה</div>
        <div className="text-xs text-ink-50">תופיע אצל שניכם מיד</div>
      </div>
    </button>
  );
}

export default function ListsPage() {
  const router = useRouter();
  const [lists, setLists] = useState<ListWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [newListType, setNewListType] = useState<'supermarket' | 'pharmacy' | 'house'>('supermarket');
  const [user, setUser] = useState<any>(null);
  const [householdMembers, setHouseholdMembers] = useState<Array<{ name: string; emoji: string; bg: string }>>([]);
  const [items, setItems] = useState<Record<string, any[]>>({});
  const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; listId: string | null; listName: string }>({ show: false, listId: null, listName: '' });
  const [undoData, setUndoData] = useState<{ list: ListWithProgress; items: any[] } | null>(null);

  useEffect(() => {
    const checkAuthAndLoadLists = async () => {
      try {
        const { data: { user: currentUser } } = await supabase.auth.getUser();

        if (!currentUser) {
          router.push('/auth/signup');
          return;
        }

        setUser(currentUser);

        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('household_id, name')
          .eq('id', currentUser.id)
          .single();

        if (userError || !userData) {
          router.push('/auth/name');
          return;
        }

        if (userData?.household_id) {
          const { data: householdUsersData } = await supabase
            .from('users')
            .select('name')
            .eq('household_id', userData.household_id);

          const memberColors = ['#C7D8BB', '#F2C9B1', '#E8C4B8', '#D4E5D8'];
          const members = householdUsersData?.map((u, i) => ({
            name: u.name,
            emoji: i === 0 ? '🧑' : '👩',
            bg: memberColors[i % memberColors.length],
          })) || [];
          setHouseholdMembers(members);

          const { data: listData } = await supabase
            .from('lists')
            .select('*')
            .eq('household_id', userData.household_id);

          setLists(listData || []);

          if (listData && listData.length > 0) {
            const { data: itemsData } = await supabase
              .from('items')
              .select('*')
              .in('list_id', listData.map((l) => l.id));

            const itemsByList: Record<string, any[]> = {};
            listData.forEach((l) => {
              itemsByList[l.id] = itemsData?.filter((i) => i.list_id === l.id) || [];
            });
            setItems(itemsByList);
          }
        }
      } finally {
        setLoading(false);
      }
    };

    checkAuthAndLoadLists();
  }, [router]);

  const handleCreateList = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newListName.trim() || !user) return;

    const { data: userData } = await supabase
      .from('users')
      .select('household_id')
      .eq('id', user.id)
      .single();

    if (!userData?.household_id) return;

    const { data: newList, error: createError } = await supabase
      .from('lists')
      .insert({
        name: newListName,
        type: newListType,
        household_id: userData.household_id,
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating list:', createError.message);
      return;
    }

    setLists([...lists, { ...newList, tickedCount: 0, totalCount: 0 }]);
    setItems({ ...items, [newList.id]: [] });
    setShowCreateSheet(false);
    setNewListName('');
    setNewListType('supermarket');
  };

  const handleDeleteList = async (listId: string) => {
    const listToDelete = lists.find((l) => l.id === listId);
    const listItems = items[listId] || [];

    const { error } = await supabase
      .from('lists')
      .delete()
      .eq('id', listId);

    if (error) {
      console.error('Error deleting list:', error.message);
      return;
    }

    // Save for undo
    if (listToDelete) {
      setUndoData({ list: listToDelete, items: listItems });
      setTimeout(() => setUndoData(null), 5000); // Clear undo after 5 seconds
    }

    setLists(lists.filter((l) => l.id !== listId));
    const newItems = { ...items };
    delete newItems[listId];
    setItems(newItems);
    setDeleteConfirm({ show: false, listId: null, listName: '' });
  };

  const handleUndelete = async () => {
    if (!undoData) return;

    const { data: newList, error: insertError } = await supabase
      .from('lists')
      .insert({
        id: undoData.list.id,
        name: undoData.list.name,
        type: undoData.list.type,
        household_id: undoData.list.household_id,
        created_at: undoData.list.created_at,
        updated_at: undoData.list.updated_at,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error undoing delete:', insertError.message);
      return;
    }

    setLists([...lists, newList]);
    setItems({ ...items, [undoData.list.id]: undoData.items });
    setUndoData(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="text-center">טוען...</div>
      </div>
    );
  }

  const isEmpty = lists.length === 0;

  return (
    <div className="min-h-screen bg-cream pb-32 flex flex-col">
      {/* Header */}
      <div className="px-6 pt-5 pb-3">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              {householdMembers.map((member) => (
                <MemberDot key={member.name} bg={member.bg} emoji={member.emoji} />
              ))}
              <div className="text-xs font-bold text-ink-70">
                {householdMembers.map((m) => m.name).join(' ו')}
              </div>
            </div>
            <h1 className="text-3xl font-bold leading-tight">הרשימות שלנו</h1>
          </div>
          <button className="icon-btn text-lg">
            <Settings size={20} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 px-4">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center gap-6 py-20 text-center min-h-96">
            <div className="w-32 h-32 rounded-full bg-accent-bg flex items-center justify-center text-6xl relative">
              <span className="block" style={{ transform: 'rotate(-8deg)' }}>
                <EmojiIcon emoji="📝" />
              </span>
            </div>
            <div className="flex flex-col gap-2">
              <h2 className="text-2xl font-bold">אין רשימות עדיין</h2>
              <p className="text-sm text-ink-70 leading-relaxed">התחילו עם רשימה אחת. אפשר סופר, בית מרקחת או בית.</p>
            </div>
            <button
              onClick={() => setShowCreateSheet(true)}
              className="btn btn-accent"
            >
              צור רשימה ראשונה
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {lists.map((list) => {
              const listItems = items[list.id] || [];
              const ticked = listItems.filter((i) => i.ticked).length;
              return (
                <ListCard
                  key={list.id}
                  list={list}
                  onOpen={() => router.push(`/lists/${list.id}`)}
                  ticked={ticked}
                  total={listItems.length}
                  onDelete={() => setDeleteConfirm({ show: true, listId: list.id, listName: list.name })}
                />
              );
            })}
            <CreateListButton onClick={() => setShowCreateSheet(true)} />
          </div>
        )}
      </div>

      {/* Create List Sheet */}
      {showCreateSheet && (
        <div className="fixed inset-0 bg-black/40 flex items-end z-50">
          <div className="w-full bg-cream rounded-t-3xl rounded-b-0 shadow-sheet max-h-4/5 overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-ink-06">
              <button
                onClick={() => setShowCreateSheet(false)}
                className="btn btn-ghost"
              >
                ביטול
              </button>
              <h2 className="text-lg font-bold">רשימה חדשה</h2>
              <button
                onClick={() => {
                  if (newListName.trim()) {
                    handleCreateList(new Event('submit') as any);
                  }
                }}
                className="btn btn-accent"
              >
                צור
              </button>
            </div>

            <div className="p-6 flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-ink-70">שם הרשימה</label>
                <input
                  type="text"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  placeholder="סופר תל אביב"
                  className="input"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-ink-70">סוג הרשימה</label>
                <div className="flex flex-col gap-2">
                  {(['supermarket', 'pharmacy', 'house'] as const).map((type) => {
                    const typeInfo = listTypeNames[type];
                    return (
                      <button
                        key={type}
                        onClick={() => setNewListType(type)}
                        className={`flex items-center gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                          newListType === type
                            ? 'bg-accent-bg border-accent-dark'
                            : 'bg-surface border-ink-10 hover:border-accent'
                        }`}
                      >
                        <div
                          className="w-12 h-12 rounded-lg flex items-center justify-center text-xl flex-shrink-0"
                          style={{ background: typeInfo.tint }}
                        >
                          {typeInfo.emoji}
                        </div>
                        <div className="flex-1 text-right">
                          <div className="font-bold text-base">{typeInfo.label}</div>
                          <div className="text-xs text-ink-50">10 קטגוריות</div>
                        </div>
                        {newListType === type && (
                          <div className="text-accent-dark font-bold">✓</div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="bg-surface rounded-2xl p-3 flex items-start gap-2 border border-ink-06">
                <span className="text-lg flex-shrink-0">👥</span>
                <div className="text-xs text-ink-70 leading-relaxed">
                  הרשימה תהיה משותפת אוטומטית עם <b>השותף שלך</b>.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm.show && deleteConfirm.listId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-cream rounded-2xl p-6 w-full max-w-sm">
            <h2 className="text-lg font-bold mb-2 text-right">למחוק את הרשימה?</h2>
            <p className="text-sm text-ink-70 mb-6 text-right">{"רשימת: \"" + deleteConfirm.listName + "\" תימחק לתמיד"}</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm({ show: false, listId: null, listName: '' })}
                className="flex-1 btn btn-ghost"
              >
                ביטול
              </button>
              <button
                onClick={() => deleteConfirm.listId && handleDeleteList(deleteConfirm.listId)}
                className="flex-1 btn bg-red-500 hover:bg-red-600 text-white border-0"
              >
                מחק
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Undo Toast */}
      {undoData && (
        <div className="fixed bottom-6 left-6 right-6 bg-ink-70 text-cream rounded-xl p-4 shadow-lg flex items-center justify-between z-40">
          <div className="text-sm font-medium">הרשימה נמחקה</div>
          <button
            onClick={handleUndelete}
            className="text-accent font-bold text-sm hover:opacity-80 transition-opacity border-0 bg-transparent cursor-pointer"
          >
            בטל
          </button>
        </div>
      )}
    </div>
  );
}
