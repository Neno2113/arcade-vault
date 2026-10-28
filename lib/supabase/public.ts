import { createClient } from '@supabase/supabase-js';

// Cliente sin cookies: lo usan las lecturas con `use cache` y la Server Action
// de puntajes, que no pueden leer `cookies()`.
export function createPublicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url) throw new Error('Falta la variable NEXT_PUBLIC_SUPABASE_URL');
  if (!key) {
    throw new Error('Falta la variable NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
