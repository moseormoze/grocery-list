'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { signUpWithEmail } from '@/lib/supabase/auth';

export default function SignUpPage() {
  const searchParams = useSearchParams();
  const inviteToken = searchParams?.get('invite') ?? undefined;
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const validateEmail = (e: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError('כתובת דוא״ל נדרשת');
      return;
    }

    if (!validateEmail(email)) {
      setError('כתובת דוא״ל לא תקינה');
      return;
    }

    setLoading(true);
    const result = await signUpWithEmail(email, inviteToken);

    if (!result.success) {
      setError(result.error || 'שגיאה בשליחת קישור');
      setLoading(false);
      return;
    }

    setSent(true);
  };

  if (sent) {
    return (
      <div className="min-h-screen bg-cream flex flex-col items-center justify-center px-6 py-8">
        <div className="w-32 h-32 rounded-full bg-accent-bg flex items-center justify-center text-5xl mb-8">
          📬
        </div>
        <h2 className="text-2xl font-bold text-center mb-3 max-w-sm">בדוק את הדוא״ל שלך</h2>
        <p className="text-sm text-ink-70 text-center mb-8 max-w-sm leading-relaxed">
          שלחנו קישור התחברות לכתובת <span className="ltr font-bold">{email}</span>
        </p>
        <button
          onClick={() => {
            setSent(false);
            setEmail('');
          }}
          className="btn btn-soft"
        >
          חזור
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream flex flex-col items-center justify-center px-6 py-8">
      <div className="w-full max-w-sm flex flex-col gap-8">
        <div className="flex flex-col gap-2 text-center">
          <div className="text-5xl">📝</div>
          <h1 className="text-3xl font-bold">ברוכים הבאים</h1>
          <p className="text-sm text-ink-70">בואו נתחיל עם רשימת קניות משותפת</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-ink-70">כתובת דוא״ל</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              dir="auto"
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
            {loading ? 'שולח...' : 'שלח קישור התחברות'}
          </button>
        </form>

        <div className="text-center text-xs text-ink-70">
          <p>נראה שאתה חדש בכאן? אנחנו ניצור לך חשבון.</p>
        </div>
      </div>
    </div>
  );
}
