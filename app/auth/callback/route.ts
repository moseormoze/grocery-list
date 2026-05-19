import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { routeAfterCallback } from '@/lib/auth/routeAfterCallback';

// Server-side OAuth/magic-link callback. The PKCE flow stores its code_verifier
// in HTTP-only cookies set by the browser client when signInWithOtp ran; only a
// server can read those back to call exchangeCodeForSession, which is why this
// is a Route Handler and not a client page.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const inviteToken = searchParams.get('invite');

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(
        `${origin}/auth/signup?error=${encodeURIComponent(error.message)}`
      );
    }
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${origin}/auth/signup`);
  }

  const { data: userProfile } = await supabase
    .from('users')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();

  const decision = routeAfterCallback({
    hasUser: true,
    hasProfile: !!userProfile,
    pendingInviteToken: inviteToken,
  });

  switch (decision.kind) {
    case 'invite':
      return NextResponse.redirect(`${origin}/invite/${decision.token}`);
    case 'name':
      return NextResponse.redirect(`${origin}/auth/name`);
    case 'lists':
      return NextResponse.redirect(`${origin}/lists`);
    case 'error':
    default:
      return NextResponse.redirect(`${origin}/auth/signup`);
  }
}
