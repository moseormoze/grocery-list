import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateInviteToken, consumeInviteToken, createInviteToken } from '../invites';
import * as client from '../client';

vi.mock('../client', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(),
  },
}));

describe('Invite Token Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validateInviteToken', () => {
    it('should call validate_invite_token RPC with the hashed token (never the plaintext)', async () => {
      const mockSupabase = client.supabase as any;
      mockSupabase.rpc.mockResolvedValueOnce({
        data: [{ household_id: 'household-123', is_valid: true, reason: 'OK' }],
        error: null,
      });

      const result = await validateInviteToken('plaintext-token-abc');

      if (!result.success) throw new Error(`expected success, got: ${result.error}`);
      expect(result.data.household_id).toBe('household-123');
      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'validate_invite_token',
        expect.objectContaining({ p_token_hash: expect.any(String) })
      );
      const callArgs = mockSupabase.rpc.mock.calls[0][1];
      expect(callArgs.p_token_hash).not.toBe('plaintext-token-abc');
      expect(callArgs.p_token_hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should map NOT_FOUND reason to a not-found error', async () => {
      const mockSupabase = client.supabase as any;
      mockSupabase.rpc.mockResolvedValueOnce({
        data: [{ household_id: null, is_valid: false, reason: 'NOT_FOUND' }],
        error: null,
      });

      const result = await validateInviteToken('plaintext-token-abc');

      if (result.success) throw new Error('expected failure');
      expect(result.error.toLowerCase()).toContain('not found');
    });

    it('should map CONSUMED reason to an already-used error', async () => {
      const mockSupabase = client.supabase as any;
      mockSupabase.rpc.mockResolvedValueOnce({
        data: [{ household_id: 'household-123', is_valid: false, reason: 'CONSUMED' }],
        error: null,
      });

      const result = await validateInviteToken('plaintext-token-abc');

      if (result.success) throw new Error('expected failure');
      expect(result.error.toLowerCase()).toContain('already been used');
    });

    it('should map EXPIRED reason to an expired error', async () => {
      const mockSupabase = client.supabase as any;
      mockSupabase.rpc.mockResolvedValueOnce({
        data: [{ household_id: 'household-123', is_valid: false, reason: 'EXPIRED' }],
        error: null,
      });

      const result = await validateInviteToken('plaintext-token-abc');

      if (result.success) throw new Error('expected failure');
      expect(result.error.toLowerCase()).toContain('expired');
    });

    it('should pass through RPC errors', async () => {
      const mockSupabase = client.supabase as any;
      mockSupabase.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'permission denied' },
      });

      const result = await validateInviteToken('plaintext-token-abc');

      if (result.success) throw new Error('expected failure');
      expect(result.error).toBe('permission denied');
    });
  });

  describe('consumeInviteToken', () => {
    it('should call consume_invite_token RPC with hashed token + user id, and return householdId on success', async () => {
      const mockSupabase = client.supabase as any;
      mockSupabase.rpc.mockResolvedValueOnce({
        data: [{ household_id: 'household-123', is_valid: true, reason: 'OK' }],
        error: null,
      });

      const result = await consumeInviteToken('plaintext-token-abc', 'user-456');

      if (!result.success) throw new Error(`expected success, got: ${result.error}`);
      expect(result.householdId).toBe('household-123');
      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'consume_invite_token',
        expect.objectContaining({
          p_token_hash: expect.any(String),
          p_user_id: 'user-456',
        })
      );
      const callArgs = mockSupabase.rpc.mock.calls[0][1];
      expect(callArgs.p_token_hash).not.toBe('plaintext-token-abc');
    });

    it('should fail with CONSUMED when token is already consumed', async () => {
      const mockSupabase = client.supabase as any;
      mockSupabase.rpc.mockResolvedValueOnce({
        data: [{ household_id: 'household-123', is_valid: false, reason: 'CONSUMED' }],
        error: null,
      });

      const result = await consumeInviteToken('plaintext-token-abc', 'user-456');

      if (result.success) throw new Error('expected failure');
      expect(result.error.toLowerCase()).toContain('already');
    });

    it('should fail with EXPIRED when token is expired', async () => {
      const mockSupabase = client.supabase as any;
      mockSupabase.rpc.mockResolvedValueOnce({
        data: [{ household_id: 'household-123', is_valid: false, reason: 'EXPIRED' }],
        error: null,
      });

      const result = await consumeInviteToken('plaintext-token-abc', 'user-456');

      if (result.success) throw new Error('expected failure');
      expect(result.error.toLowerCase()).toContain('expired');
    });
  });

  describe('createInviteToken (unchanged behavior — still uses direct table insert)', () => {
    it('should insert into invite_tokens and return the plaintext token in the URL', async () => {
      const mockSupabase = client.supabase as any;
      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValueOnce({ data: { id: 'invite-1' }, error: null }),
        }),
      });
      mockSupabase.from.mockReturnValueOnce({ insert: mockInsert });

      const result = await createInviteToken('household-123');

      if (!result.success) throw new Error(`expected success, got: ${result.error}`);
      expect(result.token).toBeDefined();
      expect(result.inviteUrl).toContain(result.token);
      expect(mockSupabase.from).toHaveBeenCalledWith('invite_tokens');
    });
  });
});
