import { cacheTag } from "next/cache";
import { createPublicClient } from "./supabase/public";
import type { Game } from "./types";

type GameRow = Omit<Game, "best" | "plays"> & { sort_order: number };
type StatsRow = { game_id: string; plays: number; best: number | null };

export async function getGames(): Promise<Game[]> {
  "use cache";
  cacheTag("games", "scores");

  const supabase = createPublicClient();
  const [games, stats] = await Promise.all([
    supabase
      .from("games")
      .select("id, title, short, long, cat, cover, color, sort_order")
      .order("sort_order")
      .overrideTypes<GameRow[], { merge: false }>(),
    supabase
      .from("game_stats")
      .select("game_id, plays, best")
      .overrideTypes<StatsRow[], { merge: false }>(),
  ]);

  if (games.error || stats.error) {
    console.error("getGames:", games.error ?? stats.error);
    throw new Error("No se pudo cargar el catálogo de juegos");
  }

  const byGame = new Map(stats.data.map((s) => [s.game_id, s]));
  return games.data.map((g) => ({
    id: g.id,
    title: g.title,
    short: g.short,
    long: g.long,
    cat: g.cat,
    cover: g.cover,
    color: g.color,
    best: byGame.get(g.id)?.best ?? null,
    plays: byGame.get(g.id)?.plays ?? 0,
  }));
}

export async function getGame(id: string): Promise<Game | undefined> {
  "use cache";
  cacheTag("games", "scores");

  return (await getGames()).find((g) => g.id === id);
}
