import { supabase } from './client';
import crypto from 'crypto';

function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

const VALIDATE_REASON_MESSAGES: Record<string, string> = {
  NOT_FOUND: 'Invite token not found',
  CONSUMED: 'This invite has already been used',
  EXPIRED: 'Invite token has expired',
};

const CONSUME_REASON_MESSAGES: Record<string, string> = {
  NOT_FOUND: 'Invite not found',
  CONSUMED: 'Invite already consumed',
  EXPIRED: 'Invite expired',
};

type RpcRow = {
  household_id: string | null;
  is_valid: boolean;
  reason: string;
};

export type CreateInviteResult =
  | { success: true; token: string; inviteUrl: string }
  | { success: false; error: string };

export type ValidateInviteResult =
  | { success: true; data: { household_id: string | null } }
  | { success: false; error: string };

export type ConsumeInviteResult =
  | { success: true; householdId: string | null }
  | { success: false; error: string };

function firstRow<T>(data: T | T[] | null): T | null {
  if (data === null || data === undefined) return null;
  return Array.isArray(data) ? (data[0] ?? null) : data;
}

export async function createInviteToken(householdId: string): Promise<CreateInviteResult> {
  try {
    const token = generateToken();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { error } = await supabase
      .from('invite_tokens')
      .insert({
        household_id: householdId,
        token_hash: tokenHash,
        expires_at: expiresAt,
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      token,
      inviteUrl: `${process.env.NEXT_PUBLIC_APP_URL}/invite/${token}`,
    };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

export async function validateInviteToken(token: string): Promise<ValidateInviteResult> {
  try {
    const tokenHash = hashToken(token);

    const { data, error } = await supabase.rpc('validate_invite_token', {
      p_token_hash: tokenHash,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    const row = firstRow<RpcRow>(data);
    if (!row) {
      return { success: false, error: VALIDATE_REASON_MESSAGES.NOT_FOUND };
    }

    if (!row.is_valid) {
      return {
        success: false,
        error: VALIDATE_REASON_MESSAGES[row.reason] ?? 'Invalid invite token',
      };
    }

    return { success: true, data: { household_id: row.household_id } };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

export async function consumeInviteToken(token: string, userId: string): Promise<ConsumeInviteResult> {
  try {
    const tokenHash = hashToken(token);

    const { data, error } = await supabase.rpc('consume_invite_token', {
      p_token_hash: tokenHash,
      p_user_id: userId,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    const row = firstRow<RpcRow>(data);
    if (!row) {
      return { success: false, error: CONSUME_REASON_MESSAGES.NOT_FOUND };
    }

    if (!row.is_valid) {
      return {
        success: false,
        error: CONSUME_REASON_MESSAGES[row.reason] ?? 'Invalid invite token',
      };
    }

    return { success: true, householdId: row.household_id };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}
