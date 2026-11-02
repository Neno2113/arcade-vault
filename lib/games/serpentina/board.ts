export type Cell = { c: number; r: number };
export type Dir = 'up' | 'down' | 'left' | 'right';

export const W = 800;
export const H = 600;
export const CELL = 40;
export const COLS = W / CELL;
export const ROWS = H / CELL;

export const START_LENGTH = 3;
export const START_HEAD: Cell = { c: 10, r: 7 };

export const BASE_STEP_MS = 150;
export const STEP_DECREASE_MS = 10;
export const MIN_STEP_MS = 60;
export const FRUITS_PER_LEVEL = 5;
export const POINTS_PER_FRUIT = 10;
export const MAX_DT = 0.05; // s
export const MAX_QUEUED_TURNS = 2;
export const GAME_OVER_DELAY = 1.2; // s

export function stepMs(level: number): number {
  return Math.max(MIN_STEP_MS, BASE_STEP_MS - (level - 1) * STEP_DECREASE_MS);
}

export function levelFor(fruitsEaten: number): number {
  return 1 + Math.floor(fruitsEaten / FRUITS_PER_LEVEL);
}

export function randomFreeCell(occupied: Cell[]): Cell | null {
  const taken = new Set(occupied.map((p) => p.r * COLS + p.c));
  const free: Cell[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (!taken.has(r * COLS + c)) free.push({ c, r });
    }
  }
  if (free.length === 0) return null;
  return free[Math.floor(Math.random() * free.length)];
}
