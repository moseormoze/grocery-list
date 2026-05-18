'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useList } from '@/hooks/useList';
import { getOfflineQueue } from '@/lib/offline/queue';
import type { Item } from '@/lib/db/types';

const SECTIONS: Record<string, string> = {
  dairy: 'חלביות',
  produce: 'ירקות ופירות',
  meat: 'בשר',
  dry_goods: 'דברים יבשים',
  baking: 'אפיה',
  cleaning: 'ניקיון',
  snacks: 'חטיפים',
  beverages: 'משקאות',
  frozen: 'קפוא',
  other: 'אחר',
};

export default function ListDetailPage() {
  const router = useRouter();
  const params = useParams();
  const listId = params?.listId as string;

  const { list, items, loading, error, refetch, updateOptimistically } = useList(listId);
  const [mode, setMode] = useState<'browse' | 'edit'>('browse');
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [itemName, setItemName] = useState('');
  const [itemQty, setItemQty] = useState('');
  const [itemSection, setItemSection] = useState('other');
  const [showConfirmTrip, setShowConfirmTrip] = useState(false);

  if (loading) {
    return <div style={{ padding: 32, textAlign: 'center' }}>טוען...</div>;
  }

  if (error || !list) {
    return <div style={{ padding: 32, textAlign: 'center', color: '#c33' }}>שגיאה: {error}</div>;
  }

  const tickedCount = items.filter((i) => i.ticked).length;
  const totalCount = items.length;

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!itemName.trim()) return;

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
  };

  const handleTickItem = async (item: Item) => {
    const updated = { ...item, ticked: !item.ticked };
    updateOptimistically(updated);

    const { error } = await supabase
      .from('items')
      .update({ ticked: !item.ticked, updated_at: new Date().toISOString() })
      .eq('id', item.id);

    if (error) {
      updateOptimistically(item); // Revert on error
    }
  };

  const handleDeleteItem = async (item: Item) => {
    // Optimistic delete
    const queue = getOfflineQueue();
    queue.enqueue({
      id: `del-${Date.now()}`,
      listId,
      itemId: item.id,
      type: 'delete',
      data: {},
      timestamp: Date.now(),
    });

    const { error } = await supabase.from('items').delete().eq('id', item.id);

    if (error) {
      // Could refetch on error
    }
  };

  const handleCompleteTrip = async () => {
    const tickedItems = items.filter((i) => i.ticked);

    // Create snapshot
    const { error: snapshotError } = await supabase.from('list_snapshots').insert({
      list_id: listId,
      items_snapshot: tickedItems,
      created_at: new Date().toISOString(),
    });

    if (!snapshotError) {
      // Delete ticked items
      const itemIds = tickedItems.map((i) => i.id);
      await supabase.from('items').delete().in('id', itemIds);

      setShowConfirmTrip(false);
      refetch();
    }
  };

  const groupedItems = items.reduce((acc, item) => {
    const section = item.section_id || 'other';
    if (!acc[section]) acc[section] = [];
    acc[section].push(item);
    return acc;
  }, {} as Record<string, Item[]>);

  return (
    <div style={{ minHeight: '100vh', background: '#faf6ee', paddingBottom: 80 }}>
      {/* Header */}
      <div style={{ padding: '16px', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button
          onClick={() => router.back()}
          style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer' }}
        >
          ←
        </button>
        <div style={{ textAlign: 'center', flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{list.name}</h1>
        </div>
        <button
          onClick={() => setMode(mode === 'browse' ? 'edit' : 'browse')}
          style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer' }}
        >
          {mode === 'browse' ? '✏️' : '✓'}
        </button>
      </div>

      {/* Progress */}
      {totalCount > 0 && (
        <div style={{ padding: '16px', background: '#fff', margin: '8px 16px', borderRadius: 8 }}>
          <div style={{ fontSize: 13, color: '#999', marginBottom: 4 }}>
            {tickedCount} מתוך {totalCount}
          </div>
          <div style={{ height: 4, background: '#eee', borderRadius: 2, overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                background: '#22c55e',
                width: `${totalCount ? (tickedCount / totalCount) * 100 : 0}%`,
                transition: 'width .3s',
              }}
            />
          </div>
        </div>
      )}

      {/* Items */}
      <div style={{ padding: '8px 16px' }}>
        {Object.entries(groupedItems).map(([section, sectionItems]) => (
          <div key={section} style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: '#999', marginBottom: 8, textTransform: 'uppercase' }}>
              {SECTIONS[section] || section}
            </h3>
            {sectionItems.map((item) => (
              <div
                key={item.id}
                style={{
                  padding: '12px',
                  background: '#fff',
                  marginBottom: 4,
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                {mode === 'browse' ? (
                  <>
                    <input
                      type="checkbox"
                      checked={item.ticked}
                      onChange={() => handleTickItem(item)}
                      style={{ width: 20, height: 20, cursor: 'pointer' }}
                    />
                    <span
                      style={{
                        flex: 1,
                        textDecoration: item.ticked ? 'line-through' : 'none',
                        opacity: item.ticked ? 0.5 : 1,
                      }}
                    >
                      {item.name} {item.qty && `(${item.qty})`}
                    </span>
                  </>
                ) : (
                  <>
                    <span style={{ flex: 1 }}>{item.name}</span>
                    <button
                      onClick={() => {
                        setEditingItem(item);
                        setItemName(item.name);
                        setItemQty(item.qty || '');
                        setItemSection(item.section_id || 'other');
                        setShowAddSheet(true);
                      }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 }}
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDeleteItem(item)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 }}
                    >
                      🗑️
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Floating buttons */}
      <div style={{ position: 'fixed', bottom: 20, left: 16, right: 16, display: 'flex', gap: 8 }}>
        <button
          onClick={() => {
            setEditingItem(null);
            setItemName('');
            setItemQty('');
            setItemSection('other');
            setShowAddSheet(true);
          }}
          style={{
            flex: 1,
            padding: '12px',
            background: '#22c55e',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          + הוסף פריט
        </button>
        {tickedCount > 0 && mode === 'browse' && (
          <button
            onClick={() => setShowConfirmTrip(true)}
            style={{
              flex: 1,
              padding: '12px',
              background: '#f59e0b',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            סיימתי קניות
          </button>
        )}
      </div>

      {/* Add/Edit modal */}
      {showAddSheet && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.3)', display: 'flex', alignItems: 'flex-end' }}>
          <div
            style={{
              width: '100%',
              background: '#fff',
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              padding: '20px',
            }}
          >
            <form onSubmit={handleAddItem} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <input
                type="text"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                placeholder="שם הפריט"
                style={{
                  padding: '12px 16px',
                  border: '1px solid #ddd',
                  borderRadius: 8,
                  fontSize: 16,
                  boxSizing: 'border-box',
                }}
              />
              <input
                type="text"
                value={itemQty}
                onChange={(e) => setItemQty(e.target.value)}
                placeholder="כמות (אופציונלי)"
                style={{
                  padding: '12px 16px',
                  border: '1px solid #ddd',
                  borderRadius: 8,
                  fontSize: 16,
                  boxSizing: 'border-box',
                }}
              />
              <select
                value={itemSection}
                onChange={(e) => setItemSection(e.target.value)}
                style={{
                  padding: '12px 16px',
                  border: '1px solid #ddd',
                  borderRadius: 8,
                  fontSize: 16,
                }}
              >
                {Object.entries(SECTIONS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  type="submit"
                  style={{
                    flex: 1,
                    padding: '12px',
                    background: '#22c55e',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {editingItem ? 'עדכן' : 'הוסף'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddSheet(false)}
                  style={{
                    flex: 1,
                    padding: '12px',
                    background: '#f0f0f0',
                    border: 'none',
                    borderRadius: 8,
                    cursor: 'pointer',
                  }}
                >
                  ביטול
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm trip completion */}
      {showConfirmTrip && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: '24px', maxWidth: 300 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>סיימתי את הקניות?</h2>
            <p style={{ fontSize: 14, color: '#666', marginBottom: 24 }}>
              {tickedCount} פריטים שסומנו יוסרו. המשך?
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={handleCompleteTrip}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: '#22c55e',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                כן, סיימתי
              </button>
              <button
                onClick={() => setShowConfirmTrip(false)}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: '#f0f0f0',
                  border: 'none',
                  borderRadius: 8,
                  cursor: 'pointer',
                }}
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
