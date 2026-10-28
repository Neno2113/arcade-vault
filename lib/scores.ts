import { cacheTag } from "next/cache";
import { createPublicClient } from "./supabase/public";
import type { ScoreRow } from "./types";

type TopScoreRow = {
  game_id: string;
  rank: number;
  name: string;
  score: number;
  created_at: string;
};

export function toScoreRow(r: TopScoreRow): ScoreRow {
  return {
    rank: r.rank,
    name: r.name,
    score: r.score,
    date: new Date(r.created_at).toLocaleDateString("es-ES", {
      timeZone: "UTC",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }),
  };
}

export async function getTopScores(
  gameId: string,
  limit: number,
): Promise<ScoreRow[]> {
  "use cache";
  cacheTag("scores");

  const { data, error } = await createPublicClient().rpc("top_scores", {
    p_game_id: gameId,
    p_limit: limit,
  });
  if (error) {
    console.error("getTopScores:", error);
    throw new Error("No se pudo cargar el ranking");
  }
  return ((data ?? []) as TopScoreRow[]).map(toScoreRow);
}

export async function getLeaderboards(
  limit: number,
): Promise<Record<string, ScoreRow[]>> {
  "use cache";
  cacheTag("scores");

  const { data, error } = await createPublicClient().rpc("top_scores", {
    p_game_id: null,
    p_limit: limit,
  });
  if (error) {
    console.error("getLeaderboards:", error);
    throw new Error("No se pudo cargar el salón de la fama");
  }
  const boards: Record<string, ScoreRow[]> = {};
  for (const row of (data ?? []) as TopScoreRow[]) {
    (boards[row.game_id] ??= []).push(toScoreRow(row));
  }
  return boards;
}
