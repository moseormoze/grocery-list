'use client';

import { useState } from 'react';
import { signUpWithEmail } from '@/lib/supabase/auth';

export default function SignUpPage() {
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
    const result = await signUpWithEmail(email);

    if (!result.success) {
      setError(result.error || 'שגיאה בשליחת קישור');
      setLoading(false);
      return;
    }

    setSent(true);
  };

  if (sent) {
    return (
      <div style={{ padding: '32px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 24 }}>📬</div>
        <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>בדוק את הדוא״ל שלך</h2>
        <p style={{ fontSize: 16, color: '#666', marginBottom: 32 }}>
          שלחנו קישור התחברות לכתובת{' '}
          <strong style={{ direction: 'ltr' }}>{email}</strong>
        </p>
        <button
          onClick={() => {
            setSent(false);
            setEmail('');
          }}
          style={{
            padding: '12px 24px',
            background: '#f0f0f0',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            fontSize: 16,
          }}
        >
          חזור
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '32px 24px' }}>
      <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 32, textAlign: 'center' }}>
        כנס עם דוא״ל
      </h1>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 600 }}>
            כתובת דוא״ל
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            dir="auto"
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
          {loading ? 'שולח...' : 'שלח קישור התחברות'}
        </button>
      </form>
    </div>
  );
}
