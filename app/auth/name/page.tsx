'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { createHousehold, createUserProfile } from '@/lib/supabase/auth';

export default function NamePage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    // Get current user from Supabase session
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        setEmail(user.email || null);
      } else {
        router.push('/auth/signup');
      }
    };

    checkUser();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('שם נדרש');
      return;
    }

    if (!userId || !email) {
      setError('User information missing');
      return;
    }

    setLoading(true);

    try {
      // Create household for new user
      const householdResult = await createHousehold();
      if (!householdResult.success || !householdResult.householdId) {
        setError('Failed to create household');
        setLoading(false);
        return;
      }

      // Create user profile
      const userResult = await createUserProfile(userId, email, name, householdResult.householdId);
      if (!userResult.success) {
        setError(userResult.error || 'Failed to create profile');
        setLoading(false);
        return;
      }

      // Redirect to dashboard
      router.push('/lists');
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'An error occurred';
      setError(errorMsg);
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '32px 24px' }}>
      <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 32, textAlign: 'center' }}>
        מה שמך?
      </h1>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 600 }}>
            שם
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="שם שלך"
            disabled={loading}
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

        {error && (
          <div style={{ padding: 12, background: '#fee', color: '#c33', borderRadius: 8, fontSize: 14 }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '12px 24px',
            background: loading ? '#ccc' : '#22c55e',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontSize: 16,
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'יוצר...' : 'המשך'}
        </button>
      </form>
    </div>
  );
}
