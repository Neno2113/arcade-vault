export type BlockColor =
  'red' | 'yellow' | 'cyan' | 'magenta' | 'hotpink' | 'green';
export type Block = {
  x: number;
  y: number;
  w: number;
  h: number;
  color: BlockColor;
  alive: boolean;
  explodingMs: number;
};
export type Level = { ballSpeed: number; pattern: string[] };
export const BLOCK_COLORS: BlockColor[] = [
  'red',
  'yellow',
  'cyan',
  'magenta',
  'hotpink',
  'green',
];
export const BLOCK_COLS = 16;
export const BLOCK_W = 60;
export const BLOCK_H = 28;
export const BLOCKS_TOP = 100;
const CHECKER_A = '#.#.#.#.#.#.#.#.';
const CHECKER_B = '.#.#.#.#.#.#.#.#';
const FULL_ROW = '################';
export const LEVELS: Level[] = [
  { ballSpeed: 480, pattern: Array(6).fill(FULL_ROW) },
  {
    ballSpeed: 600,
    pattern: [CHECKER_A, CHECKER_B, CHECKER_A, CHECKER_B, CHECKER_A, CHECKER_B],
  },
  {
    ballSpeed: 720,
    pattern: [
      CHECKER_A,
      CHECKER_B,
      CHECKER_A,
      CHECKER_B,
      FULL_ROW,
      FULL_ROW,
      FULL_ROW,
      FULL_ROW,
    ],
  },
];
export function buildBlocks(level: number): Block[] {
  const { pattern } = LEVELS[level - 1];
  const blocks: Block[] = [];
  pattern.forEach((rowPattern, row) => {
    for (let col = 0; col < BLOCK_COLS; col++) {
      if (rowPattern[col] !== '#') continue;
      blocks.push({
        x: col * BLOCK_W,
        y: BLOCKS_TOP + row * BLOCK_H,
        w: BLOCK_W,
        h: BLOCK_H,
        color: BLOCK_COLORS[row % BLOCK_COLORS.length],
        alive: true,
        explodingMs: 0,
      });
    }
  });
  return blocks;
}
