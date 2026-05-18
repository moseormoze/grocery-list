'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { createInviteToken } from '@/lib/supabase/invites';

export default function InvitePage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkUserAndHousehold = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push('/auth/signup');
        return;
      }

      setUserId(user.id);

      const { data: userData } = await supabase
        .from('users')
        .select('household_id')
        .eq('id', user.id)
        .single();

      if (userData?.household_id) {
        setHouseholdId(userData.household_id);
      }

      setLoading(false);
    };

    checkUserAndHousehold();
  }, [router]);

  const generateInvite = async () => {
    if (!householdId) {
      setError('Household not found');
      return;
    }

    setLoading(true);
    const result = await createInviteToken(householdId);

    if (result.success) {
      setInviteUrl(result.inviteUrl || null);
    } else {
      setError(result.error || 'Failed to generate invite');
    }

    setLoading(false);
  };

  const copyToClipboard = () => {
    if (inviteUrl) {
      navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading && !inviteUrl) {
    return <div style={{ padding: 32, textAlign: 'center' }}>טוען...</div>;
  }

  if (!householdId) {
    return (
      <div style={{ padding: 32, textAlign: 'center' }}>
        <p>Household not found</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '32px 24px' }}>
      <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 32, textAlign: 'center' }}>
        הזמן את השותף שלך
      </h1>

      {error && (
        <div style={{ padding: 12, background: '#fee', color: '#c33', borderRadius: 8, marginBottom: 24 }}>
          {error}
        </div>
      )}

      {!inviteUrl ? (
        <button
          onClick={generateInvite}
          disabled={loading}
          style={{
            width: '100%',
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
          {loading ? 'יוצר...' : 'צור קישור הזמנה'}
        </button>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ padding: 16, background: '#f0f0f0', borderRadius: 8 }}>
            <p style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>קישור הזמנה:</p>
            <code
              style={{
                fontSize: 13,
                wordBreak: 'break-all',
                display: 'block',
                marginBottom: 12,
                direction: 'ltr',
              }}
            >
              {inviteUrl}
            </code>
            <button
              onClick={copyToClipboard}
              style={{
                padding: '8px 16px',
                background: '#22c55e',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              {copied ? '✓ הועתק' : 'העתק'}
            </button>
          </div>

          <button
            onClick={() => setInviteUrl(null)}
            style={{
              padding: '12px 24px',
              background: '#f0f0f0',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 16,
            }}
          >
            צור קישור חדש
          </button>
        </div>
      )}
    </div>
  );
}
