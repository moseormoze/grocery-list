import { describe, it, expect, beforeEach } from 'vitest';
import { savePendingInvite, consumePendingInvite } from '../pendingInvite';

describe('pendingInvite', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it('savePendingInvite stores the token in sessionStorage', () => {
    savePendingInvite('abc123');
    expect(window.sessionStorage.getItem('pending_invite_token')).toBe('abc123');
  });

  it('consumePendingInvite returns the stored token and clears storage', () => {
    window.sessionStorage.setItem('pending_invite_token', 'xyz789');
    expect(consumePendingInvite()).toBe('xyz789');
    expect(window.sessionStorage.getItem('pending_invite_token')).toBeNull();
  });

  it('consumePendingInvite returns null when no token is stored', () => {
    expect(consumePendingInvite()).toBeNull();
  });

  it('consumePendingInvite called twice returns null on the second call', () => {
    savePendingInvite('once');
    expect(consumePendingInvite()).toBe('once');
    expect(consumePendingInvite()).toBeNull();
  });

  it('savePendingInvite overwrites a previously stored token', () => {
    savePendingInvite('first');
    savePendingInvite('second');
    expect(consumePendingInvite()).toBe('second');
  });
});
