export const SCORE_LIMITS = { name: 10, max: 1_000_000 } as const;

type ScoreInput = { gameId: unknown; name: unknown; score: unknown };

// Saltos de línea y demás caracteres de control (C0, DEL y C1).
const CONTROL_CHARS_RE = /[\u0000-\u001f\u007f-\u009f]/;

export function validateScoreInput(
  input: ScoreInput,
):
  | { ok: true; data: { gameId: string; name: string; score: number } }
  | { ok: false } {
  const { gameId, name, score } = input;
  if (typeof gameId !== 'string' || !gameId) return { ok: false };
  if (typeof name !== 'string') return { ok: false };
  const trimmed = name.trim();
  if (
    trimmed.length < 1 ||
    trimmed.length > SCORE_LIMITS.name ||
    CONTROL_CHARS_RE.test(trimmed)
  ) {
    return { ok: false };
  }
  if (
    typeof score !== 'number' ||
    !Number.isInteger(score) ||
    score < 0 ||
    score > SCORE_LIMITS.max
  ) {
    return { ok: false };
  }
  return { ok: true, data: { gameId, name: trimmed, score } };
}
