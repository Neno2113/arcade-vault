export type Category = "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";
export type GameColor = "cyan" | "magenta" | "yellow" | "green";

export type Game = {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: Category;
  cover: string;
  color: GameColor;
  best: number | null; // null si aún no hay puntajes
  plays: number; // puntajes guardados
};

export type ScoreRow = {
  rank: number;
  name: string;
  score: number;
  date: string; // dd/mm/aaaa, formateado en el servidor en UTC
};

export type SessionUser = { name: string };
