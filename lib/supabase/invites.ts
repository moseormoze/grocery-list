import { supabase } from './client';
import crypto from 'crypto';

/**
 * Generate a unique invite token.
 */
function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Hash a token for storage (never store plaintext).
 */
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Create an invite link for a household.
 */
export async function createInviteToken(householdId: string) {
  try {
    const token = generateToken();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

    const { data, error } = await supabase
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

    // Return the plaintext token (only time it's exposed)
    return {
      success: true,
      token,
      inviteUrl: `${process.env.NEXT_PUBLIC_APP_URL}/invite/${token}`,
    };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

/**
 * Validate an invite token.
 */
export async function validateInviteToken(token: string) {
  try {
    const tokenHash = hashToken(token);

    const { data, error } = await supabase
      .from('invite_tokens')
      .select('*')
      .eq('token_hash', tokenHash)
      .single();

    if (error) {
      return { success: false, error: 'Invite token not found' };
    }

    if (data.consumed_by_user_id) {
      return { success: false, error: 'This invite has already been used' };
    }

    if (new Date(data.expires_at) < new Date()) {
      return { success: false, error: 'Invite token has expired' };
    }

    return { success: true, data };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

/**
 * Consume an invite token and add user to household.
 */
export async function consumeInviteToken(token: string, userId: string) {
  try {
    const tokenHash = hashToken(token);

    // Get the invite token
    const { data: inviteData, error: inviteError } = await supabase
      .from('invite_tokens')
      .select('*')
      .eq('token_hash', tokenHash)
      .single();

    if (inviteError || !inviteData) {
      return { success: false, error: 'Invite not found' };
    }

    if (inviteData.consumed_by_user_id) {
      return { success: false, error: 'Invite already consumed' };
    }

    if (new Date(inviteData.expires_at) < new Date()) {
      return { success: false, error: 'Invite expired' };
    }

    // Update invite token as consumed
    const { error: updateError } = await supabase
      .from('invite_tokens')
      .update({ consumed_by_user_id: userId })
      .eq('id', inviteData.id);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    // Add user to household
    // (In a real app, you'd update user's household_id)
    return { success: true, householdId: inviteData.household_id };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}
