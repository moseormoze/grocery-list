import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  signUpWithEmail,
  verifyMagicLink,
  createUserProfile,
  getUserHousehold,
  createHousehold,
} from '../auth';
import * as client from '../client';

// Mock the Supabase client
vi.mock('../client', () => ({
  supabase: {
    auth: {
      signInWithOtp: vi.fn(),
      verifyOtp: vi.fn(),
      getUser: vi.fn(),
    },
    from: vi.fn(),
  },
}));

describe('Auth Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('signUpWithEmail', () => {
    it('should return success when email is sent', async () => {
      const mockSupabase = client.supabase as any;
      mockSupabase.auth.signInWithOtp.mockResolvedValueOnce({ error: null });

      const result = await signUpWithEmail('test@example.com');

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
      expect(mockSupabase.auth.signInWithOtp).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@example.com',
          options: expect.objectContaining({
            shouldCreateUser: true,
          }),
        })
      );
    });

    it('should return error when signup fails', async () => {
      const mockSupabase = client.supabase as any;
      mockSupabase.auth.signInWithOtp.mockResolvedValueOnce({
        error: { message: 'Invalid email' },
      });

      const result = await signUpWithEmail('invalid');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid email');
    });
  });

  describe('verifyMagicLink', () => {
    it('should verify token successfully', async () => {
      const mockSupabase = client.supabase as any;
      mockSupabase.auth.verifyOtp.mockResolvedValueOnce({ error: null });

      const result = await verifyMagicLink('test-token');

      expect(result.success).toBe(true);
      expect(mockSupabase.auth.verifyOtp).toHaveBeenCalledWith(
        expect.objectContaining({
          token_hash: 'test-token',
          type: 'email',
        })
      );
    });

    it('should return error on invalid token', async () => {
      const mockSupabase = client.supabase as any;
      mockSupabase.auth.verifyOtp.mockResolvedValueOnce({
        error: { message: 'Invalid token' },
      });

      const result = await verifyMagicLink('invalid-token');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid token');
    });
  });

  describe('createUserProfile', () => {
    it('should create user profile in household', async () => {
      const mockSupabase = client.supabase as any;
      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValueOnce({
            data: { id: 'user-123', email: 'test@example.com', name: 'Test User' },
            error: null,
          }),
        }),
      });
      mockSupabase.from.mockReturnValueOnce({ insert: mockInsert });

      const result = await createUserProfile('user-123', 'test@example.com', 'Test User', 'household-123');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(
        expect.objectContaining({
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
        })
      );
    });

    it('should return error if profile creation fails', async () => {
      const mockSupabase = client.supabase as any;
      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValueOnce({
            data: null,
            error: { message: 'Unique constraint violated' },
          }),
        }),
      });
      mockSupabase.from.mockReturnValueOnce({ insert: mockInsert });

      const result = await createUserProfile('user-123', 'test@example.com', 'Test User', 'household-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unique constraint violated');
    });
  });

  describe('getUserHousehold', () => {
    it('should return user household ID', async () => {
      const mockSupabase = client.supabase as any;
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValueOnce({
            data: { household_id: 'household-123' },
            error: null,
          }),
        }),
      });
      mockSupabase.from.mockReturnValueOnce({ select: mockSelect });

      const result = await getUserHousehold('user-123');

      expect(result.success).toBe(true);
      expect(result.householdId).toBe('household-123');
    });

    it('should return error if user not found', async () => {
      const mockSupabase = client.supabase as any;
      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValueOnce({
            data: null,
            error: { message: 'User not found' },
          }),
        }),
      });
      mockSupabase.from.mockReturnValueOnce({ select: mockSelect });

      const result = await getUserHousehold('user-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('User not found');
    });
  });

  describe('createHousehold', () => {
    it('should create household and return ID', async () => {
      const mockSupabase = client.supabase as any;
      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValueOnce({
            data: { id: 'household-123' },
            error: null,
          }),
        }),
      });
      mockSupabase.from.mockReturnValueOnce({ insert: mockInsert });

      const result = await createHousehold();

      expect(result.success).toBe(true);
      expect(result.householdId).toBe('household-123');
    });

    it('should return error if creation fails', async () => {
      const mockSupabase = client.supabase as any;
      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValueOnce({
            data: null,
            error: { message: 'Database error' },
          }),
        }),
      });
      mockSupabase.from.mockReturnValueOnce({ insert: mockInsert });

      const result = await createHousehold();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');
    });
  });
});
