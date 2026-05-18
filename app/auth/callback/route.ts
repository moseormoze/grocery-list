import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';
import { verifyMagicLink } from '@/lib/supabase/auth';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  if (error) {
    return NextResponse.redirect(
      new URL(`/auth/signup?error=${encodeURIComponent(errorDescription || error)}`, request.url)
    );
  }

  if (!code) {
    return NextResponse.redirect(new URL('/auth/signup?error=invalid_code', request.url));
  }

  try {
    // Verify the magic link token
    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      return NextResponse.redirect(
        new URL(`/auth/signup?error=${encodeURIComponent(exchangeError.message)}`, request.url)
      );
    }

    if (!data.user) {
      return NextResponse.redirect(new URL('/auth/signup?error=user_not_found', request.url));
    }

    // Check if user profile exists
    const { data: userProfile } = await supabase
      .from('users')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (!userProfile) {
      // New user: redirect to name entry
      const response = NextResponse.redirect(new URL('/auth/name', request.url));
      response.cookies.set('temp_user_id', data.user.id, { httpOnly: true });
      response.cookies.set('temp_user_email', data.user.email || '', { httpOnly: true });
      return response;
    }

    // Existing user: redirect to dashboard
    return NextResponse.redirect(new URL('/lists', request.url));
  } catch (e) {
    console.error('Callback error:', e);
    return NextResponse.redirect(
      new URL(`/auth/signup?error=${encodeURIComponent('Authentication failed')}`, request.url)
    );
  }
}
