'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useList } from '@/hooks/useList';
import type { List } from '@/lib/db/types';

export default function ListsPage() {
  const router = useRouter();
  const [lists, setLists] = useState<List[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [newListType, setNewListType] = useState<'supermarket' | 'pharmacy' | 'house'>('supermarket');
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const checkAuthAndLoadLists = async () => {
      const { data: { user: currentUser } } = await supabase.auth.getUser();

      if (!currentUser) {
        router.push('/auth/signup');
        return;
      }

      setUser(currentUser);

      const { data: userData } = await supabase
        .from('users')
        .select('household_id')
        .eq('id', currentUser.id)
        .single();

      if (userData?.household_id) {
        const { data: listData } = await supabase
          .from('lists')
          .select('*')
          .eq('household_id', userData.household_id);

        setLists(listData || []);
      }

      setLoading(false);
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
      setError(createError.message);
      return;
    }

    setLists([...lists, newList]);
    setShowCreateSheet(false);
    setNewListName('');
    setNewListType('supermarket');
  };

  return (
    <div style={{ padding: '20px', minHeight: '100vh', background: '#faf6ee' }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 30, fontWeight: 700, marginBottom: 8 }}>הרשימות שלנו</h1>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 32 }}>טוען...</div>
      ) : lists.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 32 }}>
          <p style={{ fontSize: 16, color: '#666', marginBottom: 24 }}>אין רשימות עדיין</p>
          <button
            onClick={() => setShowCreateSheet(true)}
            style={{
              padding: '12px 24px',
              background: '#22c55e',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontSize: 16,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            צור רשימה ראשונה
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {lists.map((list) => (
            <button
              key={list.id}
              onClick={() => router.push(`/lists/${list.id}`)}
              style={{
                padding: 16,
                background: '#fff',
                border: 'none',
                borderRadius: 12,
                textAlign: 'right',
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(0,0,0,.05)',
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 4 }}>{list.name}</div>
              <div style={{ fontSize: 13, color: '#999' }}>
                {list.type === 'supermarket' && '🛒'}
                {list.type === 'pharmacy' && '💊'}
                {list.type === 'house' && '🏠'} {list.type}
              </div>
            </button>
          ))}

          <button
            onClick={() => setShowCreateSheet(true)}
            style={{
              padding: 16,
              background: 'transparent',
              border: '2px dashed #ccc',
              borderRadius: 12,
              cursor: 'pointer',
              fontSize: 16,
              fontWeight: 600,
            }}
          >
            + צור רשימה חדשה
          </button>
        </div>
      )}

      {showCreateSheet && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.3)', display: 'flex', alignItems: 'flex-end' }}>
          <div
            style={{
              width: '100%',
              background: '#fff',
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              padding: '20px',
              maxHeight: '80vh',
              overflowY: 'auto',
            }}
          >
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>רשימה חדשה</h2>

            <form onSubmit={handleCreateList} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 600 }}>
                  שם הרשימה
                </label>
                <input
                  type="text"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  placeholder="סופר תל אביב"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    border: '1px solid #ddd',
                    borderRadius: 8,
                    fontSize: 16,
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 600 }}>
                  סוג הרשימה
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(['supermarket', 'pharmacy', 'house'] as const).map((type) => (
                    <label
                      key={type}
                      style={{
                        padding: 12,
                        border: newListType === type ? '2px solid #22c55e' : '1px solid #ddd',
                        borderRadius: 8,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <input
                        type="radio"
                        checked={newListType === type}
                        onChange={() => setNewListType(type)}
                      />
                      <span>
                        {type === 'supermarket' && '🛒'}
                        {type === 'pharmacy' && '💊'}
                        {type === 'house' && '🏠'} {type}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  type="submit"
                  style={{
                    flex: 1,
                    padding: '12px 24px',
                    background: '#22c55e',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    fontSize: 16,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  צור
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateSheet(false)}
                  style={{
                    flex: 1,
                    padding: '12px 24px',
                    background: '#f0f0f0',
                    border: 'none',
                    borderRadius: 8,
                    fontSize: 16,
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
    </div>
  );
}
