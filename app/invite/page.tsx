'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { createInviteToken } from '@/lib/supabase/invites';

export default function InvitePage() {
  const router = useRouter();
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
    return (
      <div className="min-h-screen bg-cream flex flex-col items-center justify-center px-6">
        <p className="text-ink-70">טוען...</p>
      </div>
    );
  }

  if (!householdId) {
    return (
      <div className="min-h-screen bg-cream flex flex-col items-center justify-center px-6">
        <div className="text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <p className="text-ink-70">Household not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream flex flex-col items-center justify-center px-6 py-8">
      <div className="w-full max-w-sm flex flex-col gap-8">
        <div className="flex flex-col gap-2 text-center">
          <div className="text-5xl">👥</div>
          <h1 className="text-3xl font-bold">הזמן את השותף שלך</h1>
          <p className="text-sm text-ink-70">שתפו קישור הזמנה כדי להתחיל יחד</p>
        </div>

        {error && (
          <div className="px-4 py-3 bg-danger/10 text-danger rounded-lg text-sm font-medium border border-danger/20">
            {error}
          </div>
        )}

        {!inviteUrl ? (
          <button
            onClick={generateInvite}
            disabled={loading}
            className={`px-6 py-3 text-ink border-0 rounded-full text-base font-bold cursor-pointer transition-colors ${
              loading ? 'bg-ink-10 cursor-not-allowed' : 'bg-accent hover:bg-accent-dark'
            }`}
          >
            {loading ? 'יוצר...' : 'צור קישור הזמנה'}
          </button>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="p-4 bg-surface rounded-2xl border border-ink-06">
              <p className="text-xs font-bold text-ink-70 mb-2">קישור הזמנה:</p>
              <code className="text-xs word-break block mb-3 ltr font-mono p-2 bg-ink-06 rounded text-ink">
                {inviteUrl}
              </code>
              <button
                onClick={copyToClipboard}
                className={`w-full px-4 py-3 border-0 rounded-full text-sm font-bold cursor-pointer transition-colors ${
                  copied ? 'bg-green-100 text-green-800' : 'bg-accent text-ink hover:bg-accent-dark'
                }`}
              >
                {copied ? '✓ הועתק' : 'העתק'}
              </button>
            </div>

            <button
              onClick={() => setInviteUrl(null)}
              className="py-3 bg-ink-06 border-0 rounded-full cursor-pointer text-base text-ink-70 font-bold hover:bg-ink-10 transition-colors"
            >
              צור קישור חדש
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
