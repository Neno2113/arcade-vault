import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('ping');
    if (error) throw error;
    return NextResponse.json({ ok: true, ping: data });
  } catch (error) {
    console.error('[health] Falló la conexión con Supabase:', error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
