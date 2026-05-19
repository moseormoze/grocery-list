'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { validateInviteToken, consumeInviteToken } from '@/lib/supabase/invites';
import { createUserProfile } from '@/lib/supabase/auth';
import { savePendingInvite } from '@/lib/auth/pendingInvite';

export default function InviteAcceptPage() {
  const router = useRouter();
  const params = useParams();
  const token = params?.token as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user: currentUser } } = await supabase.auth.getUser();

      if (!currentUser) {
        savePendingInvite(token);
        router.push(`/auth/signup`);
        return;
      }

      setUser(currentUser);

      // Validate token
      const validation = await validateInviteToken(token);
      if (!validation.success) {
        setError(validation.error || 'Invalid invite');
        setLoading(false);
        return;
      }

      setHouseholdId(validation.data.household_id);

      // Check if user already has a profile
      const { data: userProfile } = await supabase
        .from('users')
        .select('id')
        .eq('id', currentUser.id)
        .single();

      // If they already have a profile in a different household, error
      if (userProfile) {
        setError('חשבון זה כבר קשור לבית אחר');
        setLoading(false);
        return;
      }

      setLoading(false);
    };

    if (token) {
      checkAuth();
    }
  }, [token, router]);

  const handleAcceptInvite = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError('שם נדרש');
      return;
    }

    if (!user || !householdId) {
      setError('Missing user or household information');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // Consume the invite token
      const consumeResult = await consumeInviteToken(token, user.id);
      if (!consumeResult.success) {
        setError(consumeResult.error || 'Failed to accept invite');
        setSubmitting(false);
        return;
      }

      // Create user profile with the partner's household
      const profileResult = await createUserProfile(user.id, user.email || '', name, householdId);
      if (!profileResult.success) {
        setError(profileResult.error || 'Failed to create profile');
        setSubmitting(false);
        return;
      }

      // Redirect to lists
      router.push('/lists');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex flex-col items-center justify-center px-6">
        <p className="text-ink-70">טוען...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-cream flex flex-col items-center justify-center px-6 py-8">
        <div className="w-32 h-32 rounded-full bg-danger/10 flex items-center justify-center text-5xl mb-8">
          ⚠️
        </div>
        <h1 className="text-2xl font-bold text-center mb-3">שגיאה</h1>
        <p className="text-sm text-danger text-center mb-8 max-w-sm">{error}</p>
        <button
          onClick={() => router.push('/lists')}
          className="btn btn-accent"
        >
          חזור לבית
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream flex flex-col items-center justify-center px-6 py-8">
      <div className="w-full max-w-sm flex flex-col gap-8">
        <div className="flex flex-col gap-2 text-center">
          <div className="text-5xl">👋</div>
          <h1 className="text-3xl font-bold">הצטרף לרשימה</h1>
          <p className="text-sm text-ink-70">היוו חלק מהרשימה המשותפת</p>
        </div>

        <form onSubmit={handleAcceptInvite} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-ink-70">שם מלא</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="שם שלך"
              disabled={submitting}
              dir="auto"
              className="input"
            />
          </div>

          {error && (
            <div className="px-4 py-3 bg-danger/10 text-danger rounded-lg text-sm font-medium border border-danger/20">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="btn btn-accent w-full"
          >
            {submitting ? 'מצטרף...' : 'קבל הזמנה'}
          </button>
        </form>
      </div>
    </div>
  );
}
