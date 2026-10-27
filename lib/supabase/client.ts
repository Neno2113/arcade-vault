import { createBrowserClient } from '@supabase/ssr';
export function createClient() {
  // Next solo inlinea NEXT_PUBLIC_* con acceso estático (process.env.NOMBRE).
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url) throw new Error('Falta la variable NEXT_PUBLIC_SUPABASE_URL');
  if (!key) {
    throw new Error('Falta la variable NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
  }
  return createBrowserClient(url, key);
}
