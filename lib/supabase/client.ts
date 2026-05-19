import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

// Cookie-backed session storage. iOS PWAs share cookies with Safari/Chrome
// for the same origin much more reliably than localStorage, which is fully
// scoped per WebView context. macro-tracker (NextAuth + JWT cookies) works
// in PWAs for the same reason; this brings parity.
export const supabase = createBrowserClient(supabaseUrl, supabaseKey);

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  return { error };
}
