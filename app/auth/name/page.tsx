'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { createHousehold, createUserProfile } from '@/lib/supabase/auth';
import { consumePendingInvite } from '@/lib/auth/pendingInvite';

function NamePageFallback() {
  return (
    <div className="min-h-screen bg-cream flex items-center justify-center">
      <div className="text-ink-70 font-medium">טוען...</div>
    </div>
  );
}

function NamePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const checkUser = async () => {
      const inviteFromUrl = searchParams?.get('invite') ?? null;
      const inviteFromStorage = consumePendingInvite();
      const pendingInvite = inviteFromUrl ?? inviteFromStorage;

      if (pendingInvite) {
        router.replace(`/invite/${pendingInvite}`);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        setEmail(user.email || null);
      } else {
        router.push('/auth/signup');
      }
    };

    checkUser();
  }, [router, searchParams]);

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
    <div className="min-h-screen bg-cream flex flex-col items-center justify-center px-6 py-8">
      <div className="w-full max-w-sm flex flex-col gap-8">
        <div className="flex flex-col gap-2 text-center">
          <div className="text-5xl">👤</div>
          <h1 className="text-3xl font-bold">מה שמך?</h1>
          <p className="text-sm text-ink-70">נשתמש בשם הזה כדי להזכיר את זהותך</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-ink-70">שם מלא</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="שם שלך"
              disabled={loading}
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
            disabled={loading}
            className="btn btn-accent w-full"
          >
            {loading ? 'יוצר...' : 'המשך'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function NamePage() {
  return (
    <Suspense fallback={<NamePageFallback />}>
      <NamePageInner />
    </Suspense>
  );
}
