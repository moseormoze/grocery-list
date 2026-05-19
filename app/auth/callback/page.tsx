'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

export default function AuthCallback() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        console.log('Checking authenticated user after Supabase redirect');

        // Supabase already verified the token server-side and set the session
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          console.error('No authenticated user found');
          setError('Authentication failed. Please try again.');
          return;
        }

        console.log('User authenticated:', user.id);

        // Check if user profile exists
        const { data: userProfile, error: profileError } = await supabase
          .from('users')
          .select('id')
          .eq('id', user.id)
          .single();

        if (profileError && profileError.code !== 'PGRST116') {
          console.error('Profile lookup error:', profileError);
          setError(`Profile lookup failed: ${profileError.message}`);
          return;
        }

        // If profile doesn't exist, redirect to name setup
        if (!userProfile) {
          console.log('No user profile, redirecting to /auth/name');
          router.push('/auth/name');
        } else {
          console.log('User profile found, redirecting to /lists');
          router.push('/lists');
        }
      } catch (error) {
        console.error('Callback error:', error);
        setError(`Error: ${error instanceof Error ? error.message : String(error)}`);
      }
    };

    handleCallback();
  }, [router]);

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
          className="px-6 py-3 bg-accent text-ink border-0 rounded-full font-bold cursor-pointer hover:bg-accent-dark transition-colors"
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
