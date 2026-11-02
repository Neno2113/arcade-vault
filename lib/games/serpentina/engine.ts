import type { EngineCallbacks, GameStats } from '@/components/games/types';
import {
  CELL,
  COLS,
  GAME_OVER_DELAY,
  MAX_DT,
  MAX_QUEUED_TURNS,
  POINTS_PER_FRUIT,
  ROWS,
  START_HEAD,
  START_LENGTH,
  levelFor,
  randomFreeCell,
  stepMs,
  type Cell,
  type Dir,
} from './board';
import { FRUITS, FRUIT_NAMES, loadFruitsSheet, type FruitName } from './sprites';

type Status = 'playing' | 'dying' | 'won';

const DELTAS: Record<Dir, Cell> = {
  up: { c: 0, r: -1 },
  down: { c: 0, r: 1 },
  left: { c: -1, r: 0 },
  right: { c: 1, r: 0 },
};
const BOARD_DARK = '#0b0b12';
const BOARD_LIGHT = '#0e0e17';
const SNAKE_BODY = '#00d977';
const SNAKE_HEAD = '#b6ffd9';
const SNAKE_HEAD_DEAD = '#ff006e'; // --magenta
const SEGMENT_INSET = 2; // px
const FRUIT_HEIGHT = 36; // px, ancho máx. CELL

const KEY_DIRS: Record<string, Dir> = {
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
};
const ARROW_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

const OPPOSITE: Record<Dir, Dir> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};

export class SerpentinaEngine {
  private ctx: CanvasRenderingContext2D;
  private callbacks: EngineCallbacks;
  private status: Status = 'playing';
  private snake: Cell[] = [];
  private dir: Dir = 'right';
  private turnQueue: Dir[] = [];
  private fruit: Cell | null = null;
  private fruitName: FruitName = FRUIT_NAMES[0];
  private score = 0;
  private eaten = 0;
  private acc = 0; // ms acumulados desde el último paso
  private gameOverTimer: ReturnType<typeof setTimeout> | null = null;
  private sheet: CanvasImageSource | null = null;
  private paused = false;
  private started = false;
  private destroyed = false;
  private rafId: number | null = null;
  private lastTime: number | null = null;
  private lastStats: { score: number; level: number; length: number } | null = null;

  constructor(canvas: HTMLCanvasElement, callbacks: EngineCallbacks) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D no disponible');
    this.ctx = ctx;
    this.callbacks = callbacks;
    for (let i = 0; i < START_LENGTH; i++) {
      this.snake.push({ c: START_HEAD.c - i, r: START_HEAD.r });
    }
    this.spawnFruit();
  }

  start() {
    if (this.started || this.destroyed) return;
    this.started = true;
    loadFruitsSheet().then(
      (sheet) => {
        // destroy() pudo llamarse mientras el PNG cargaba (modo estricto).
        if (this.destroyed) return;
        this.sheet = sheet;
        window.addEventListener('keydown', this.onKeyDown);
        window.addEventListener('keyup', this.onKeyUp);
        this.emitStats();
        this.draw();
        this.lastTime = null;
        this.rafId = requestAnimationFrame(this.loop);
      },
      (err) => {
        if (!this.destroyed) console.error(err);
      },
    );
  }

  setPaused(paused: boolean) {
    if (this.paused === paused) return;
    this.paused = paused;
    // Evita un salto de dt y un paso inmediato al reanudar.
    this.lastTime = null;
    this.acc = 0;
  }

  destroy() {
    this.destroyed = true;
    this.started = false;
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    if (this.gameOverTimer !== null) clearTimeout(this.gameOverTimer);
    this.gameOverTimer = null;
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
  }

  private isTyping(e: KeyboardEvent) {
    const t = e.target;
    return t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement;
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (this.isTyping(e)) return;
    if (ARROW_KEYS.includes(e.code)) e.preventDefault();
    if (e.repeat || this.status !== 'playing') return;
    if (e.code === 'KeyP') {
      this.callbacks.onTogglePause?.();
      return;
    }
    if (this.paused) return;
    const dir = KEY_DIRS[e.code];
    if (dir) this.queueTurn(dir);
  };

  private onKeyUp = (e: KeyboardEvent) => {
    if (this.isTyping(e)) return;
    if (ARROW_KEYS.includes(e.code)) e.preventDefault();
  };

  private loop = (time: number) => {
    this.rafId = requestAnimationFrame(this.loop);
    if (this.paused) return;
    const dt = this.lastTime === null ? 0 : Math.min((time - this.lastTime) / 1000, MAX_DT);
    this.lastTime = time;
    this.update(dt);
    this.draw();
  };

  private draw() {
    const { ctx } = this;
    ctx.imageSmoothingEnabled = false;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        ctx.fillStyle = (c + r) % 2 === 0 ? BOARD_DARK : BOARD_LIGHT;
        ctx.fillRect(c * CELL, r * CELL, CELL, CELL);
      }
    }
    if (this.fruit && this.sheet) {
      const f = FRUITS[this.fruitName];
      const h = FRUIT_HEIGHT;
      const w = Math.min(CELL, Math.round((f.w * h) / f.h));
      const x = this.fruit.c * CELL + (CELL - w) / 2;
      const y = this.fruit.r * CELL + (CELL - h) / 2;
      ctx.drawImage(this.sheet, f.x, f.y, f.w, f.h, x, y, w, h);
    }
    const size = CELL - SEGMENT_INSET * 2;
    for (let i = this.snake.length - 1; i >= 0; i--) {
      const s = this.snake[i];
      ctx.fillStyle =
        i === 0 ? (this.status === 'dying' ? SNAKE_HEAD_DEAD : SNAKE_HEAD) : SNAKE_BODY;
      ctx.fillRect(s.c * CELL + SEGMENT_INSET, s.r * CELL + SEGMENT_INSET, size, size);
    }
  }

  private queueTurn(dir: Dir) {
    if (this.turnQueue.length >= MAX_QUEUED_TURNS) return;
    const last = this.turnQueue[this.turnQueue.length - 1] ?? this.dir;
    if (dir === last || dir === OPPOSITE[last]) return;
    this.turnQueue.push(dir);
  }

  private spawnFruit() {
    this.fruit = randomFreeCell(this.snake);
    this.fruitName = FRUIT_NAMES[Math.floor(Math.random() * FRUIT_NAMES.length)];
  }

  private step() {
    const next = this.turnQueue.shift();
    if (next) this.dir = next;
    const head = this.snake[0];
    const d = DELTAS[this.dir];
    const to = { c: head.c + d.c, r: head.r + d.r };
    if (to.c < 0 || to.c >= COLS || to.r < 0 || to.r >= ROWS) {
      this.die();
      return;
    }
    const eats = this.fruit !== null && to.c === this.fruit.c && to.r === this.fruit.r;
    // La cola deja su celda en este paso, salvo que la serpiente crezca.
    const body = eats ? this.snake : this.snake.slice(0, -1);
    if (body.some((s) => s.c === to.c && s.r === to.r)) {
      this.die();
      return;
    }
    this.snake.unshift(to);
    if (eats) this.eat();
    else this.snake.pop();
  }

  private eat() {
    this.score += POINTS_PER_FRUIT;
    this.eaten += 1;
    this.spawnFruit();
    this.emitStats();
    if (this.fruit === null) this.finish('won');
  }

  private die() {
    this.finish('dying');
  }

  private finish(status: 'dying' | 'won') {
    this.status = status;
    this.turnQueue = [];
    this.gameOverTimer = setTimeout(() => {
      this.gameOverTimer = null;
      this.callbacks.onGameOver(this.score);
    }, GAME_OVER_DELAY * 1000);
  }

  private update(dt: number) {
    if (this.status !== 'playing') return;
    this.acc += dt * 1000;
    while (this.status === 'playing' && this.acc >= stepMs(levelFor(this.eaten))) {
      this.acc -= stepMs(levelFor(this.eaten));
      this.step();
    }
  }

  private emitStats() {
    const level = levelFor(this.eaten);
    const length = this.snake.length;
    const last = this.lastStats;
    if (last && last.score === this.score && last.level === level && last.length === length) return;
    this.lastStats = { score: this.score, level, length };
    const stats: GameStats = {
      score: this.score,
      lives: null,
      level,
      extras: [{ label: 'Longitud', value: String(length) }],
    };
    this.callbacks.onStats(stats);
  }
}
