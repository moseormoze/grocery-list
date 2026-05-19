'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { consumePendingInvite } from '@/lib/auth/pendingInvite';
import { routeAfterCallback } from '@/lib/auth/routeAfterCallback';

export default function AuthCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();

        const inviteFromUrl = searchParams?.get('invite') ?? null;
        const inviteFromStorage = consumePendingInvite();
        const pendingInviteToken = inviteFromUrl ?? inviteFromStorage;

        if (!user) {
          setError('Authentication failed. Please try again.');
          return;
        }

        const { data: userProfile, error: profileError } = await supabase
          .from('users')
          .select('id')
          .eq('id', user.id)
          .single();

        if (profileError && profileError.code !== 'PGRST116') {
          setError(`Profile lookup failed: ${profileError.message}`);
          return;
        }

        const decision = routeAfterCallback({
          hasUser: true,
          hasProfile: !!userProfile,
          pendingInviteToken,
        });

        switch (decision.kind) {
          case 'invite':
            router.push(`/invite/${decision.token}`);
            break;
          case 'name':
            router.push('/auth/name');
            break;
          case 'lists':
            router.push('/lists');
            break;
          case 'error':
            setError('Authentication failed. Please try again.');
            break;
        }
      } catch (error) {
        setError(`Error: ${error instanceof Error ? error.message : String(error)}`);
      }
    };

    handleCallback();
  }, [router, searchParams]);

  if (error) {
    return (
      <div className="min-h-screen bg-cream flex flex-col items-center justify-center px-6 py-8">
        <div className="w-32 h-32 rounded-full bg-danger/10 flex items-center justify-center text-5xl mb-8">
          ⚠️
        </div>
        <h1 className="text-2xl font-bold text-center mb-3">שגיאה בהתחברות</h1>
        <p className="text-sm text-danger text-center mb-8 max-w-sm">{error}</p>
        <button
          onClick={() => router.push('/auth/signup')}
          className="btn btn-accent"
        >
          חזור להתחברות
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream flex flex-col items-center justify-center px-6">
      <div className="flex flex-col items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-accent-bg flex items-center justify-center text-3xl animate-pulse">
          ✓
        </div>
        <p className="text-ink-70 font-medium">מאומת...</p>
      </div>
    </div>
  );
}
