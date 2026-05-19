import { describe, it, expect } from 'vitest';
import { routeAfterCallback } from '../routeAfterCallback';

describe('routeAfterCallback', () => {
  it('returns error when no authenticated user', () => {
    expect(
      routeAfterCallback({ hasUser: false, hasProfile: false, pendingInviteToken: null })
    ).toEqual({ kind: 'error', reason: 'no-user' });
  });

  it('routes to invite landing when a pending invite token exists, even if profile is missing', () => {
    expect(
      routeAfterCallback({ hasUser: true, hasProfile: false, pendingInviteToken: 'tok-1' })
    ).toEqual({ kind: 'invite', token: 'tok-1' });
  });

  it('routes to invite landing when a pending invite token exists, even for a returning user with a profile', () => {
    expect(
      routeAfterCallback({ hasUser: true, hasProfile: true, pendingInviteToken: 'tok-2' })
    ).toEqual({ kind: 'invite', token: 'tok-2' });
  });

  it('routes to name setup for a new user without a profile and no pending invite', () => {
    expect(
      routeAfterCallback({ hasUser: true, hasProfile: false, pendingInviteToken: null })
    ).toEqual({ kind: 'name' });
  });

  it('routes to lists for a returning user with a profile and no pending invite', () => {
    expect(
      routeAfterCallback({ hasUser: true, hasProfile: true, pendingInviteToken: null })
    ).toEqual({ kind: 'lists' });
  });
});
