import { supabase } from './client';

export interface SignUpResult {
  success: boolean;
  error?: string;
}

export async function signUpWithEmail(email: string, inviteToken?: string): Promise<SignUpResult> {
  try {
    const callbackUrl = inviteToken
      ? `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?invite=${encodeURIComponent(inviteToken)}`
      : `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`;

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: callbackUrl,
        shouldCreateUser: true,
      },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

export async function verifyMagicLink(token: string): Promise<SignUpResult> {
  try {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: token,
      type: 'email',
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

export async function createUserProfile(userId: string, email: string, name: string, householdId: string) {
  try {
    const { data, error } = await supabase
      .from('users')
      .insert({
        id: userId,
        email,
        name,
        household_id: householdId,
      })
      .select()
      .single();

    if (error) {
      console.error('createUserProfile error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (e) {
    console.error('createUserProfile exception:', e);
    return { success: false, error: String(e) };
  }
}

export async function getUserHousehold(userId: string) {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('household_id')
      .eq('id', userId)
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, householdId: data?.household_id };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

export async function createHousehold() {
  try {
    const { data, error } = await supabase
      .from('households')
      .insert({})
      .select()
      .single();

    if (error) {
      console.error('createHousehold error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, householdId: data?.id };
  } catch (e) {
    console.error('createHousehold exception:', e);
    return { success: false, error: String(e) };
  }
}
