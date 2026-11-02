import type { EngineCallbacks, GameStats } from '@/components/games/types';
import {
  BLOCK,
  BOARD_X,
  COLORS,
  COLS,
  GAME_OVER_DELAY,
  H,
  KICKS,
  LINE_SCORES,
  MAX_DT,
  NEXT_X,
  NEXT_Y,
  PIECES,
  ROWS,
  W,
  collide,
  createBoard,
  rotateCW,
  type Board,
  type Shape,
} from './pieces';
const CONTROL_KEYS = [
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Space',
];
type Piece = { type: number; shape: Shape; x: number; y: number };
export class CaidaEngine {
  private ctx: CanvasRenderingContext2D;
  private callbacks: EngineCallbacks;
  private board: Board = createBoard();
  private current: Piece;
  private next: Piece;
  private score = 0;
  private lines = 0;
  private level = 1;
  private dropInterval = 1000;
  private dropAccum = 0;
  private gameOver = false;
  private gameOverTimer: ReturnType<typeof setTimeout> | null = null;
  private lastStats: GameStats | null = null;
  private lastTime: number | null = null;
  private rafId: number | null = null;
  private paused = false;
  private started = false;
  constructor(canvas: HTMLCanvasElement, callbacks: EngineCallbacks) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D no disponible');
    this.ctx = ctx;
    this.callbacks = callbacks;
    this.current = this.randomPiece();
    this.next = this.randomPiece();
  }
  start() {
    if (this.started) return;
    this.started = true;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    this.draw();
    this.emitStats();
    this.rafId = requestAnimationFrame(this.loop);
  }
  setPaused(paused: boolean) {
    if (this.paused === paused) return;
    this.paused = paused;
    // Evita un salto de dt al reanudar.
    this.lastTime = null;
  }
  destroy() {
    this.started = false;
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    if (this.gameOverTimer !== null) clearTimeout(this.gameOverTimer);
    this.gameOverTimer = null;
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
  }
  // ── Input ───────────────────────────────────────────────────────────────────
  private isTyping(e: KeyboardEvent) {
    const t = e.target;
    return t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement;
  }
  private onKeyDown = (e: KeyboardEvent) => {
    if (this.isTyping(e)) return;
    if (CONTROL_KEYS.includes(e.code)) e.preventDefault();
    if (this.gameOver) return;
    if (e.code === 'KeyP') {
      if (!e.repeat) this.callbacks.onTogglePause?.();
      return;
    }
    if (this.paused) return;
    switch (e.code) {
      case 'ArrowLeft':
        this.move(-1);
        break;
      case 'ArrowRight':
        this.move(1);
        break;
      case 'ArrowDown':
        this.softDrop();
        break;
      case 'ArrowUp':
      case 'KeyX':
        if (!e.repeat) this.rotate();
        break;
      case 'Space':
        if (!e.repeat) this.hardDrop();
        break;
    }
  };
  private onKeyUp = (e: KeyboardEvent) => {
    if (this.isTyping(e)) return;
    if (CONTROL_KEYS.includes(e.code)) e.preventDefault();
  };
  // ── Piezas ──────────────────────────────────────────────────────────────────
  private randomPiece(): Piece {
    const type = Math.floor(Math.random() * 7) + 1;
    const shape = PIECES[type]!.map((row) => [...row]);
    return {
      type,
      shape,
      x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2),
      y: 0,
    };
  }
  private spawn() {
    this.current = this.next;
    this.next = this.randomPiece();
    if (collide(this.board, this.current.shape, this.current.x, this.current.y))
      this.endGame();
  }
  private endGame() {
    this.gameOver = true;
    this.gameOverTimer = setTimeout(() => {
      this.gameOverTimer = null;
      this.callbacks.onGameOver(this.score);
    }, GAME_OVER_DELAY * 1000);
  }
  private lockPiece() {
    const { shape, x, y } = this.current;
    for (let r = 0; r < shape.length; r++)
      for (let c = 0; c < shape[r].length; c++)
        if (shape[r][c]) this.board[y + r][x + c] = shape[r][c];
    this.clearLines();
    this.spawn();
    this.emitStats();
  }
  private clearLines() {
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (this.board[r].every((v) => v !== 0)) {
        this.board.splice(r, 1);
        this.board.unshift(new Array<number>(COLS).fill(0));
        cleared++;
        r++;
      }
    }
    if (cleared) {
      this.lines += cleared;
      // El nivel que multiplica es el vigente antes de recalcularlo.
      this.score += (LINE_SCORES[cleared] || 0) * this.level;
      this.level = Math.floor(this.lines / 10) + 1;
      this.dropInterval = Math.max(100, 1000 - (this.level - 1) * 90);
    }
  }
  // ── Acciones del jugador ────────────────────────────────────────────────────
  private move(dx: number) {
    if (this.gameOver) return;
    const { shape, x, y } = this.current;
    if (!collide(this.board, shape, x + dx, y)) this.current.x += dx;
  }
  private rotate() {
    if (this.gameOver) return;
    const rotated = rotateCW(this.current.shape);
    for (const kick of KICKS) {
      if (
        !collide(this.board, rotated, this.current.x + kick, this.current.y)
      ) {
        this.current.shape = rotated;
        this.current.x += kick;
        return;
      }
    }
  }
  private softDrop() {
    if (this.gameOver) return;
    const { shape, x, y } = this.current;
    if (!collide(this.board, shape, x, y + 1)) {
      this.current.y++;
      this.score += 1;
      this.emitStats();
    } else {
      this.lockPiece();
    }
  }
  private hardDrop() {
    if (this.gameOver) return;
    const gy = this.ghostY();
    this.score += (gy - this.current.y) * 2;
    this.current.y = gy;
    this.lockPiece();
  }
  private ghostY() {
    const { shape, x } = this.current;
    let gy = this.current.y;
    while (!collide(this.board, shape, x, gy + 1)) gy++;
    return gy;
  }
  // ── Stats ───────────────────────────────────────────────────────────────────
  private emitStats() {
    const stats: GameStats = {
      score: this.score,
      lives: null,
      level: this.level,
      extras: [{ label: 'Líneas', value: String(this.lines) }],
    };
    const last = this.lastStats;
    if (
      last &&
      last.score === stats.score &&
      last.level === stats.level &&
      last.extras?.[0]?.value === stats.extras?.[0]?.value
    )
      return;
    this.lastStats = stats;
    this.callbacks.onStats(stats);
  }
  // ── Draw ────────────────────────────────────────────────────────────────────
  private drawBlock(
    x: number,
    y: number,
    colorIndex: number,
    ox: number,
    oy: number,
    alpha = 1,
  ) {
    if (!colorIndex) return;
    const { ctx } = this;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = COLORS[colorIndex]!;
    ctx.fillRect(ox + x * BLOCK + 1, oy + y * BLOCK + 1, BLOCK - 2, BLOCK - 2);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(ox + x * BLOCK + 1, oy + y * BLOCK + 1, BLOCK - 2, 4);
    ctx.globalAlpha = 1;
  }
  private drawGrid() {
    const { ctx } = this;
    ctx.strokeStyle = '#22222e';
    ctx.lineWidth = 0.5;
    for (let c = 1; c < COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(BOARD_X + c * BLOCK, 0);
      ctx.lineTo(BOARD_X + c * BLOCK, ROWS * BLOCK);
      ctx.stroke();
    }
    for (let r = 1; r < ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(BOARD_X, r * BLOCK);
      ctx.lineTo(BOARD_X + COLS * BLOCK, r * BLOCK);
      ctx.stroke();
    }
  }
  private drawNext() {
    const { ctx } = this;
    ctx.fillStyle = '#1a1a25';
    ctx.fillRect(NEXT_X, NEXT_Y, 4 * BLOCK, 4 * BLOCK);
    ctx.strokeStyle = '#2a2a3a';
    ctx.lineWidth = 1;
    ctx.strokeRect(NEXT_X + 0.5, NEXT_Y + 0.5, 4 * BLOCK - 1, 4 * BLOCK - 1);
    ctx.fillStyle = '#8a8aa0';
    ctx.font = '10px "Press Start 2P", monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('SIGUIENTE', NEXT_X, NEXT_Y - 12);
    const shape = this.next.shape;
    const offX = Math.floor((4 - shape[0].length) / 2);
    const offY = Math.floor((4 - shape.length) / 2);
    for (let r = 0; r < shape.length; r++)
      for (let c = 0; c < shape[r].length; c++)
        this.drawBlock(offX + c, offY + r, shape[r][c], NEXT_X, NEXT_Y);
  }
  private draw() {
    const { ctx } = this;
    ctx.fillStyle = '#0f0f17';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#1a1a25';
    ctx.fillRect(BOARD_X, 0, COLS * BLOCK, ROWS * BLOCK);
    this.drawGrid();
    ctx.strokeStyle = '#2a2a3a';
    ctx.lineWidth = 1;
    ctx.strokeRect(BOARD_X + 0.5, 0.5, COLS * BLOCK - 1, ROWS * BLOCK - 1);
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        this.drawBlock(c, r, this.board[r][c], BOARD_X, 0);
    const { shape, x, y } = this.current;
    const gy = this.ghostY();
    for (let r = 0; r < shape.length; r++)
      for (let c = 0; c < shape[r].length; c++)
        if (shape[r][c])
          this.drawBlock(x + c, gy + r, shape[r][c], BOARD_X, 0, 0.2);
    for (let r = 0; r < shape.length; r++)
      for (let c = 0; c < shape[r].length; c++)
        this.drawBlock(x + c, y + r, shape[r][c], BOARD_X, 0);
    this.drawNext();
  }
  // ── Loop principal ──────────────────────────────────────────────────────────
  private loop = (ts: number) => {
    if (!this.started) return;
    if (!this.paused) {
      const dt =
        this.lastTime === null
          ? 0
          : Math.min((ts - this.lastTime) / 1000, MAX_DT);
      this.lastTime = ts;
      // El acumulador solo se reinicia cuando dispara la gravedad, como en el original.
      this.dropAccum += dt * 1000;
      if (this.dropAccum >= this.dropInterval) {
        this.dropAccum = 0;
        const { shape, x, y } = this.current;
        if (!collide(this.board, shape, x, y + 1)) this.current.y++;
        else this.lockPiece();
      }
      this.draw();
      // Tablero congelado a la vista hasta que el temporizador abra el modal.
      if (this.gameOver) {
        this.rafId = null;
        return;
      }
    }
    this.rafId = requestAnimationFrame(this.loop);
  };
}
