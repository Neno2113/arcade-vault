export type Shape = number[][];
export type Board = number[][];
export const COLS = 10;
export const ROWS = 20;
export const BLOCK = 30;
export const COLORS: (string | null)[] = [
  null,
  '#4dd0e1', // I - cian
  '#ffd54f', // O - amarillo
  '#ba68c8', // T - púrpura
  '#81c784', // S - verde
  '#e57373', // Z - rojo
  '#7986cb', // J - índigo
  '#ffb74d', // L - naranja
];
export const PIECES: (Shape | null)[] = [
  null,
  [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ], // I
  [
    [2, 2],
    [2, 2],
  ], // O
  [
    [0, 3, 0],
    [3, 3, 3],
    [0, 0, 0],
  ], // T
  [
    [0, 4, 4],
    [4, 4, 0],
    [0, 0, 0],
  ], // S
  [
    [5, 5, 0],
    [0, 5, 5],
    [0, 0, 0],
  ], // Z
  [
    [6, 0, 0],
    [6, 6, 6],
    [0, 0, 0],
  ], // J
  [
    [0, 0, 7],
    [7, 7, 7],
    [0, 0, 0],
  ], // L
];
export const LINE_SCORES = [0, 100, 300, 500, 800];
export const KICKS = [0, -1, 1, -2, 2]; // patadas horizontales al rotar
// Propias del port
export const W = 800;
export const H = 600;
export const BOARD_X = 250; // tablero centrado
export const NEXT_X = 590; // panel "SIGUIENTE"
export const NEXT_Y = 40;
export const GAME_OVER_DELAY = 1.2; // segundos para ver el tablero lleno antes del modal
export const MAX_DT = 0.05; // segundos
export function createBoard(): Board {
  return Array.from({ length: ROWS }, () => new Array<number>(COLS).fill(0));
}
export function rotateCW(shape: Shape): Shape {
  const rows = shape.length;
  const cols = shape[0].length;
  const result: Shape = Array.from({ length: cols }, () =>
    new Array<number>(rows).fill(0),
  );
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) result[c][rows - 1 - r] = shape[r][c];
  return result;
}
export function collide(
  board: Board,
  shape: Shape,
  ox: number,
  oy: number,
): boolean {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}
