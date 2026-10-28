'use server';

import { updateTag } from 'next/cache';
import { createPublicClient } from '@/lib/supabase/public';
import { validateScoreInput } from '@/lib/score-input';

export type SaveScoreState =
  | { status: 'idle' }
  | { status: 'success' }
  | { status: 'error'; message: string };

const GENERIC_ERROR =
  'No pudimos guardar tu puntuación. Inténtalo de nuevo.';

export async function saveScore(
  gameId: string,
  name: string,
  score: number,
): Promise<SaveScoreState> {
  const result = validateScoreInput({ gameId, name, score });
  if (!result.ok) {
    console.error('[puntuaciones] Entrada inválida:', { gameId, name, score });
    return { status: 'error', message: GENERIC_ERROR };
  }

  try {
    const { error } = await createPublicClient()
      .from('scores')
      .insert({
        game_id: result.data.gameId,
        name: result.data.name,
        score: result.data.score,
      });
    if (error) {
      console.error('[puntuaciones] Supabase devolvió un error:', error);
      return { status: 'error', message: GENERIC_ERROR };
    }
  } catch (err) {
    console.error('[puntuaciones] Falló el guardado:', err);
    return { status: 'error', message: GENERIC_ERROR };
  }

  updateTag('scores');
  return { status: 'success' };
}
