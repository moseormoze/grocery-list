'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import type { Item, ListWithProgress } from '@/lib/db/types';
import { EmojiIcon } from '@/lib/icon-map';
import { Loader2, Settings } from 'lucide-react';
import { InvitePartnerBanner } from '@/components/InvitePartnerBanner';
import { ListCard } from '@/components/ListCard';
import { LIST_TYPES, LIST_TYPE_META, type ListType } from '@/lib/list-types';
import { createListWithTemplate } from '@/lib/supabase/lists';
import { useTranslations } from '@/lib/i18n';
import type { User as AuthUser } from '@supabase/supabase-js';

function MemberDot({ bg, emoji }: { bg: string; emoji: string }) {
  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center text-base"
      style={{ background: bg, boxShadow: '0 0 0 2.5px #fff' }}
    >
      <EmojiIcon emoji={emoji} />
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
  const { t } = useTranslations();
  const [lists, setLists] = useState<ListWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [newListType, setNewListType] = useState<ListType>('supermarket');
  const [creatingList, setCreatingList] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [newlyCreatedListId, setNewlyCreatedListId] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [householdMembers, setHouseholdMembers] = useState<Array<{ name: string; emoji: string; bg: string }>>([]);
  const [items, setItems] = useState<Record<string, Item[]>>({});
  const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; listId: string | null; listName: string }>({ show: false, listId: null, listName: '' });
  const [undoData, setUndoData] = useState<{ list: ListWithProgress; items: Item[] } | null>(null);
  const creationAnimationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (creationAnimationTimer.current) clearTimeout(creationAnimationTimer.current);
  }, []);

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
            .eq('household_id', userData.household_id)
            .order('created_at', { ascending: true });

          const memberColors = ['#C7D8BB', '#F2C9B1', '#E8C4B8', '#D4E5D8'];
          const members = householdUsersData?.map((u, i) => ({
            name: u.name,
            emoji: i === 0 ? '👨' : '👩',
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

            const itemsByList: Record<string, Item[]> = {};
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

  const openCreateSheet = () => {
    setCreateError(null);
    setShowCreateSheet(true);
  };

  const closeCreateSheet = () => {
    setCreateError(null);
    setShowCreateSheet(false);
  };

  const handleCreateList = async () => {
    if (!newListName.trim() || !user) return;

    setCreatingList(true);
    setCreateError(null);

    const { data: userData } = await supabase
      .from('users')
      .select('household_id')
      .eq('id', user.id)
      .single();

    if (!userData?.household_id) {
      setCreatingList(false);
      setCreateError(t('lists.createError'));
      return;
    }

    const result = await createListWithTemplate({
      name: newListName,
      type: newListType,
      householdId: userData.household_id,
    });

    if (!result.success) {
      setCreatingList(false);
      setCreateError(t('lists.createError'));
      return;
    }

    setLists((current) => [...current, { ...result.list, tickedCount: 0, totalCount: result.items.length }]);
    setItems((current) => ({ ...current, [result.list.id]: result.items }));
    setNewlyCreatedListId(result.list.id);
    creationAnimationTimer.current = setTimeout(() => setNewlyCreatedListId(null), 180);
    setShowCreateSheet(false);
    setNewListName('');
    setNewListType('supermarket');
    setCreatingList(false);
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
        {householdMembers.length === 1 && (
          <InvitePartnerBanner onTap={() => router.push('/invite')} />
        )}
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
              <p className="text-sm text-ink-70 leading-relaxed">{t('lists.emptyDescription')}</p>
            </div>
            <button
              onClick={openCreateSheet}
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
                <div key={list.id} className={newlyCreatedListId === list.id ? 'list-card-enter' : undefined}>
                  <ListCard
                    list={list}
                    onOpen={() => router.push(`/lists/${list.id}`)}
                    ticked={ticked}
                    total={listItems.length}
                    onDelete={() => setDeleteConfirm({ show: true, listId: list.id, listName: list.name })}
                  />
                </div>
              );
            })}
            <CreateListButton onClick={openCreateSheet} />
          </div>
        )}
      </div>

      {/* Create List Sheet */}
      {showCreateSheet && (
        <div className="fixed inset-0 bg-black/40 flex items-end z-50">
          <div className="w-full bg-cream rounded-t-3xl rounded-b-0 shadow-sheet max-h-[80vh] overflow-y-auto" aria-busy={creatingList}>
            <div className="sticky top-0 z-10 bg-cream flex items-center justify-between p-5 border-b border-ink-06">
              <button
                onClick={closeCreateSheet}
                disabled={creatingList}
                className="btn btn-ghost"
              >
                ביטול
              </button>
              <h2 className="text-lg font-bold">רשימה חדשה</h2>
              <button
                onClick={handleCreateList}
                disabled={creatingList || !newListName.trim()}
                className="btn btn-accent"
              >
                {creatingList && <Loader2 size={16} className="animate-spin" />}
                {creatingList ? t('lists.creatingList') : t('lists.createList')}
              </button>
            </div>

            <div className="p-6 flex flex-col gap-5">
              {createError && (
                <div role="alert" className="rounded-xl bg-errorBg px-4 py-3 text-sm font-medium text-danger">
                  {createError}
                </div>
              )}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-ink-70">שם הרשימה</label>
                <input
                  type="text"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  placeholder={LIST_TYPE_META[newListType].listNamePlaceholder}
                  className="input"
                  dir="auto"
                  disabled={creatingList}
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-ink-70">סוג הרשימה</label>
                <div className="flex flex-col gap-2">
                  {LIST_TYPES.map((type) => {
                    const typeInfo = LIST_TYPE_META[type];
                    return (
                      <button
                        key={type}
                        onClick={() => setNewListType(type)}
                        disabled={creatingList}
                        aria-pressed={newListType === type}
                        className={`flex items-center gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all disabled:cursor-not-allowed disabled:opacity-60 ${
                          newListType === type
                            ? 'bg-accent-bg border-accent-dark'
                            : 'bg-surface border-ink-10 hover:border-accent'
                        }`}
                      >
                        <div
                          className="w-12 h-12 rounded-lg flex items-center justify-center text-xl flex-shrink-0"
                          style={{ background: typeInfo.tint }}
                        >
                          <EmojiIcon emoji={typeInfo.emoji} />
                        </div>
                        <div className="flex-1 text-right">
                          <div className="font-bold text-base">{typeInfo.label}</div>
                          <div className="text-xs text-ink-50">{typeInfo.createSubtitle}</div>
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
