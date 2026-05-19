const STORAGE_KEY = 'pending_invite_token';

export function savePendingInvite(token: string): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(STORAGE_KEY, token);
}

export function consumePendingInvite(): string | null {
  if (typeof window === 'undefined') return null;
  const token = window.sessionStorage.getItem(STORAGE_KEY);
  if (token) window.sessionStorage.removeItem(STORAGE_KEY);
  return token;
}
