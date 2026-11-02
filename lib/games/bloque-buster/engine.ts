import type { EngineCallbacks, GameStats } from '@/components/games/types';
import {
  EXPLOSION_DURATION,
  EXPLOSION_FRAMES,
  SPRITES,
  loadSpritesheet,
  type Frame,
} from './sprites';
import { LEVELS, buildBlocks, type Block, type BlockColor } from './levels';
export const WIDTH = 960;
export const HEIGHT = 720;
const MAX_DT = 1 / 30; // s, evita que la pelota atraviese bloques con un dt grande
const POINTS_PER_BLOCK = 10;
const SPEED_STEP = 0.01; // sobre la velocidad inicial del nivel, por bloque roto
const MAX_SPEED_FACTOR = 2;
const LAUNCH_ANGLE = Math.PI / 8;
const MAX_BOUNCE_ANGLE = Math.PI / 3;
const LEVEL_TRANSITION_MS = 2000;
const PARTICLE_COUNT = 8;
const PARTICLE_LIFE_MS = 400;
const PARTICLE_SPEED = 140; // px/s
const PARTICLE_GRAVITY = 400; // px/s²
const PARTICLE_SIZE = 4; // px
// Tomados del spritesheet: los nombres de los bloques no coinciden con el tono real.
const PARTICLE_COLORS: Record<BlockColor, string> = {
  red: '#c02a3e',
  yellow: '#d9bd4c',
  cyan: '#4fc99c',
  magenta: '#632ff4',
  hotpink: '#fc7d1c',
  green: '#44aaf3',
};
const GAME_OVER_DELAY = 1.2; // s
const INITIAL_LIVES = 3;
const MOVE_KEYS = ['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD'];
const CONTROL_KEYS = ['ArrowLeft', 'ArrowRight', 'Space'];
type Status = 'ready' | 'playing' | 'levelcomplete' | 'gameover' | 'won';
type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  lifeMs: number;
  maxLifeMs: number;
};
export class BloqueBusterEngine {
  private ctx: CanvasRenderingContext2D;
  private callbacks: EngineCallbacks;
  private status: Status = 'ready';
  private score = 0;
  private lives = INITIAL_LIVES;
  private level = 1;
  private blocks: Block[] = buildBlocks(1);
  private particles: Particle[] = [];
  private paddle = {
    x: (WIDTH - 140) / 2,
    y: HEIGHT - 50,
    w: 140,
    h: 18,
    speed: 650,
  };
  private ball = {
    x: 0,
    y: 0,
    r: 10,
    vx: 0,
    vy: 0,
    speed: LEVELS[0].ballSpeed,
  };
  private keys = new Set<string>();
  private levelTransitionMs = 0;
  private gameOverTimer: ReturnType<typeof setTimeout> | null = null;
  private lastStats: GameStats | null = null;
  private lastTime: number | null = null;
  private rafId: number | null = null;
  private paused = false;
  private started = false;
  private destroyed = false;
  private sheet: CanvasImageSource | null = null;
  constructor(canvas: HTMLCanvasElement, callbacks: EngineCallbacks) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D no disponible');
    this.ctx = ctx;
    this.callbacks = callbacks;
    this.stickBallToPaddle();
  }
  start() {
    if (this.started || this.destroyed) return;
    this.started = true;
    loadSpritesheet().then(
      (sheet) => {
        // destroy() pudo llamarse mientras el PNG cargaba (modo estricto).
        if (this.destroyed) return;
        this.sheet = sheet;
        window.addEventListener('keydown', this.onKeyDown);
        window.addEventListener('keyup', this.onKeyUp);
        window.addEventListener('blur', this.onBlur);
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
    if (paused) this.keys.clear();
    // Evita un salto de dt al reanudar.
    this.lastTime = null;
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
    window.removeEventListener('blur', this.onBlur);
    this.keys.clear();
  }
  // ── Input ───────────────────────────────────────────────────────────────────
  private isTyping(e: KeyboardEvent) {
    const t = e.target;
    return t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement;
  }
  private onKeyDown = (e: KeyboardEvent) => {
    if (this.isTyping(e)) return;
    if (CONTROL_KEYS.includes(e.code)) e.preventDefault();
    if (this.status === 'gameover' || this.status === 'won') return;
    if (e.code === 'KeyP') {
      if (!e.repeat) this.callbacks.onTogglePause?.();
      return;
    }
    if (this.paused) return;
    if (MOVE_KEYS.includes(e.code)) {
      this.keys.add(e.code);
    } else if (e.code === 'Space' && !e.repeat && this.status === 'ready') {
      this.launchBall();
      this.status = 'playing';
    }
  };
  private onKeyUp = (e: KeyboardEvent) => {
    if (this.isTyping(e)) return;
    if (CONTROL_KEYS.includes(e.code)) e.preventDefault();
    this.keys.delete(e.code);
  };
  private onBlur = () => {
    this.keys.clear();
  };
  private loop = (ts: number) => {
    if (this.destroyed) return;
    if (!this.paused) {
      const dt =
        this.lastTime === null
          ? 0
          : Math.min((ts - this.lastTime) / 1000, MAX_DT);
      this.lastTime = ts;
      this.update(dt);
      this.draw();
    }
    this.rafId = requestAnimationFrame(this.loop);
  };
  // ── Dibujo ──────────────────────────────────────────────────────────────────
  private drawFrame(frame: Frame, x: number, y: number, w: number, h: number) {
    if (!this.sheet) return;
    this.ctx.drawImage(
      this.sheet,
      frame.sx,
      frame.sy,
      frame.sw,
      frame.sh,
      x,
      y,
      w,
      h,
    );
  }
  private drawBlocks() {
    for (const b of this.blocks) {
      if (b.alive) {
        this.drawFrame(SPRITES.blocks[b.color], b.x, b.y, b.w, b.h);
      } else if (b.explodingMs > 0) {
        const frames = EXPLOSION_FRAMES[b.color];
        const progress = 1 - b.explodingMs / EXPLOSION_DURATION;
        const index = Math.min(
          frames.length - 1,
          Math.floor(progress * frames.length),
        );
        this.drawFrame(frames[index], b.x, b.y, b.w, b.h);
      }
    }
  }
  private drawParticles() {
    const { ctx } = this;
    for (const p of this.particles) {
      ctx.globalAlpha = p.lifeMs / p.maxLifeMs;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }
  private drawCenteredText(text: string, y: number, size: number) {
    this.ctx.font = `${size}px monospace`;
    this.ctx.fillText(text, WIDTH / 2, y);
  }
  private draw() {
    const { ctx, paddle, ball } = this;
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    this.drawBlocks();
    this.drawParticles();
    this.drawFrame(SPRITES.paddle, paddle.x, paddle.y, paddle.w, paddle.h);
    this.drawFrame(
      SPRITES.ball,
      ball.x - ball.r,
      ball.y - ball.r,
      ball.r * 2,
      ball.r * 2,
    );
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    if (this.status === 'ready') {
      this.drawCenteredText(
        'ESPACIO PARA LANZAR',
        paddle.y + paddle.h + 26,
        20,
      );
    } else if (this.status === 'levelcomplete') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.fillStyle = '#fff';
      this.drawCenteredText(`NIVEL ${this.level + 1}`, HEIGHT / 2 + 40, 72);
    }
  }
  // ── Reglas ──────────────────────────────────────────────────────────────────
  private levelBallSpeed() {
    return LEVELS[this.level - 1].ballSpeed;
  }
  private stickBallToPaddle() {
    this.ball.x = this.paddle.x + this.paddle.w / 2;
    this.ball.y = this.paddle.y - this.ball.r;
  }
  private launchBall() {
    const side = Math.random() < 0.5 ? -1 : 1;
    this.ball.speed = this.levelBallSpeed();
    this.ball.vx = side * this.ball.speed * Math.sin(LAUNCH_ANGLE);
    this.ball.vy = -this.ball.speed * Math.cos(LAUNCH_ANGLE);
  }
  private updateBall(dt: number) {
    const { ball } = this;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    if (ball.x - ball.r < 0) {
      ball.x = ball.r;
      ball.vx = Math.abs(ball.vx);
    } else if (ball.x + ball.r > WIDTH) {
      ball.x = WIDTH - ball.r;
      ball.vx = -Math.abs(ball.vx);
    }
    if (ball.y - ball.r < 0) {
      ball.y = ball.r;
      ball.vy = Math.abs(ball.vy);
    }
    this.bounceOnPaddle();
    this.bounceOnBlocks();
    if (this.blocks.every((b) => !b.alive)) {
      if (this.level < LEVELS.length) {
        this.status = 'levelcomplete';
        this.levelTransitionMs = LEVEL_TRANSITION_MS;
      } else {
        this.endGame('won');
      }
    } else if (ball.y - ball.r > HEIGHT) {
      this.loseLife();
    }
  }
  private bounceOnPaddle() {
    const { ball, paddle } = this;
    const hitsPaddle =
      ball.vy > 0 &&
      ball.y + ball.r >= paddle.y &&
      ball.y <= paddle.y + paddle.h &&
      ball.x >= paddle.x - ball.r &&
      ball.x <= paddle.x + paddle.w + ball.r;
    if (!hitsPaddle) return;
    // -1 en el borde izquierdo, 0 en el centro, 1 en el borde derecho
    const hit = Math.max(
      -1,
      Math.min(1, (ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2)),
    );
    const angle = hit * MAX_BOUNCE_ANGLE;
    ball.y = paddle.y - ball.r;
    ball.vx = ball.speed * Math.sin(angle);
    ball.vy = -ball.speed * Math.cos(angle);
  }
  private bounceOnBlocks() {
    const { ball } = this;
    for (const b of this.blocks) {
      if (!b.alive) continue;
      const nearestX = Math.max(b.x, Math.min(ball.x, b.x + b.w));
      const nearestY = Math.max(b.y, Math.min(ball.y, b.y + b.h));
      const dx = ball.x - nearestX;
      const dy = ball.y - nearestY;
      if (dx * dx + dy * dy >= ball.r * ball.r) continue;
      b.alive = false;
      b.explodingMs = EXPLOSION_DURATION;
      this.spawnParticles(b);
      this.score += POINTS_PER_BLOCK;
      this.speedUpBall();
      // Rebota en el eje con más penetración y saca la pelota del bloque
      if (Math.abs(dx) > Math.abs(dy)) {
        ball.vx = dx > 0 ? Math.abs(ball.vx) : -Math.abs(ball.vx);
        ball.x = nearestX + Math.sign(dx) * ball.r;
      } else {
        ball.vy = dy > 0 ? Math.abs(ball.vy) : -Math.abs(ball.vy);
        ball.y = nearestY + Math.sign(dy) * ball.r;
      }
      return; // un bloque por fotograma
    }
  }
  private speedUpBall() {
    const { ball } = this;
    const baseSpeed = this.levelBallSpeed();
    const newSpeed = Math.min(
      baseSpeed * MAX_SPEED_FACTOR,
      ball.speed + baseSpeed * SPEED_STEP,
    );
    const factor = newSpeed / ball.speed;
    ball.vx *= factor;
    ball.vy *= factor;
    ball.speed = newSpeed;
  }
  private spawnParticles(block: Block) {
    const cx = block.x + block.w / 2;
    const cy = block.y + block.h / 2;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      this.particles.push({
        x: cx,
        y: cy,
        vx: PARTICLE_SPEED * Math.cos(angle),
        vy: PARTICLE_SPEED * Math.sin(angle),
        size: PARTICLE_SIZE,
        color: PARTICLE_COLORS[block.color],
        lifeMs: PARTICLE_LIFE_MS,
        maxLifeMs: PARTICLE_LIFE_MS,
      });
    }
  }
  private loseLife() {
    this.lives -= 1;
    if (this.lives <= 0) {
      this.endGame('gameover');
    } else {
      this.ball.speed = this.levelBallSpeed();
      this.status = 'ready';
      this.stickBallToPaddle();
    }
  }
  private startNextLevel() {
    this.level += 1;
    this.blocks = buildBlocks(this.level);
    this.ball.speed = this.levelBallSpeed();
    this.stickBallToPaddle();
    this.status = 'ready';
  }
  private endGame(status: 'gameover' | 'won') {
    this.status = status;
    this.gameOverTimer = setTimeout(() => {
      this.gameOverTimer = null;
      this.callbacks.onGameOver(this.score);
    }, GAME_OVER_DELAY * 1000);
  }
  // ── Simulación ──────────────────────────────────────────────────────────────
  private updateExplosions(dt: number) {
    for (const b of this.blocks) {
      if (b.explodingMs > 0)
        b.explodingMs = Math.max(0, b.explodingMs - dt * 1000);
    }
  }
  private updateParticles(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.lifeMs -= dt * 1000;
      if (p.lifeMs <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.vy += PARTICLE_GRAVITY * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }
  private update(dt: number) {
    dt = Math.min(dt, MAX_DT);
    this.updateExplosions(dt);
    this.updateParticles(dt);
    if (this.status === 'levelcomplete') {
      this.levelTransitionMs -= dt * 1000;
      if (this.levelTransitionMs <= 0) this.startNextLevel();
    } else if (this.status !== 'gameover' && this.status !== 'won') {
      const { paddle } = this;
      let dir = 0;
      if (this.keys.has('ArrowLeft') || this.keys.has('KeyA')) dir -= 1;
      if (this.keys.has('ArrowRight') || this.keys.has('KeyD')) dir += 1;
      paddle.x += dir * paddle.speed * dt;
      paddle.x = Math.max(0, Math.min(WIDTH - paddle.w, paddle.x));
      if (this.status === 'ready') this.stickBallToPaddle();
      else this.updateBall(dt);
    }
    this.emitStats();
  }
  private emitStats() {
    const s = this.lastStats;
    if (
      s &&
      s.score === this.score &&
      s.lives === this.lives &&
      s.level === this.level
    )
      return;
    this.lastStats = {
      score: this.score,
      lives: this.lives,
      level: this.level,
    };
    this.callbacks.onStats(this.lastStats);
  }
}
