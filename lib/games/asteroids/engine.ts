import type { GameStats } from '@/components/games/types';
export type EngineCallbacks = {
  onStats: (stats: GameStats) => void;
  onGameOver: (score: number) => void;
};
const W = 800;
const H = 600;
const RADII = [0, 16, 30, 50]; // por tamaño 1, 2, 3
const SPEEDS = [0, 85, 55, 32]; // velocidad base por tamaño
const POINTS = [0, 100, 50, 20]; // puntos por tamaño
const POWERUP_CHANCE = 0.12; // probabilidad por asteroide destruido
const TRIPLE_DURATION = 10; // segundos de efecto
const SPREAD = 0.26; // rad entre balas del abanico (~15°)
const GAME_OVER_DELAY = 1.2; // segundos para ver la explosión antes del modal
const CONTROL_KEYS = [
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Space',
];
// ── Utils ─────────────────────────────────────────────────────────────────────
type Point = { x: number; y: number };
type Keys = Record<string, boolean | undefined>;
const wrap = (v: number, max: number) => ((v % max) + max) % max;
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const rand = (min: number, max: number) => min + Math.random() * (max - min);
const randInt = (min: number, max: number) => Math.floor(rand(min, max + 1));
// ── Bullet ────────────────────────────────────────────────────────────────────
class Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ttl = 1.1;
  radius = 2;
  dead = false;
  constructor(x: number, y: number, angle: number) {
    const SPEED = 520;
    this.x = x;
    this.y = y;
    this.vx = Math.cos(angle) * SPEED;
    this.vy = Math.sin(angle) * SPEED;
  }
  update(dt: number) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }
  draw(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}
// ── Asteroid ──────────────────────────────────────────────────────────────────
class Asteroid {
  x: number;
  y: number;
  size: number;
  radius: number;
  dead = false;
  vx: number;
  vy: number;
  rotSpeed: number;
  rot: number;
  verts: [number, number][] = [];
  constructor(x: number, y: number, size = 3) {
    this.x = x;
    this.y = y;
    this.size = size;
    this.radius = RADII[size];
    const angle = rand(0, Math.PI * 2);
    const speed = SPEEDS[size] + rand(-15, 15);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.rotSpeed = rand(-1.2, 1.2);
    this.rot = rand(0, Math.PI * 2);
    // Polígono irregular
    const n = randInt(8, 13);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = this.radius * rand(0.6, 1.0);
      this.verts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
  }
  update(dt: number) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.rot += this.rotSpeed * dt;
  }
  split(): Asteroid[] {
    if (this.size <= 1) return [];
    return [
      new Asteroid(this.x, this.y, this.size - 1),
      new Asteroid(this.x, this.y, this.size - 1),
    ];
  }
  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(this.verts[0][0], this.verts[0][1]);
    for (let i = 1; i < this.verts.length; i++)
      ctx.lineTo(this.verts[i][0], this.verts[i][1]);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
}
// ── Ship ──────────────────────────────────────────────────────────────────────
class Ship {
  x = W / 2;
  y = H / 2;
  angle = -Math.PI / 2;
  vx = 0;
  vy = 0;
  radius = 12;
  thrusting = false;
  invincible = 3;
  shootCooldown = 0;
  tripleShot = 0;
  dead = false;
  reset() {
    this.x = W / 2;
    this.y = H / 2;
    this.angle = -Math.PI / 2;
    this.vx = 0;
    this.vy = 0;
    this.thrusting = false;
    this.invincible = 3;
    this.shootCooldown = 0;
    this.tripleShot = 0;
    this.dead = false;
  }
  update(dt: number, keys: Keys) {
    if (this.dead) return;
    if (this.invincible > 0) this.invincible -= dt;
    if (this.shootCooldown > 0) this.shootCooldown -= dt;
    if (this.tripleShot > 0) this.tripleShot -= dt;
    const ROT = 3.5; // rad/s
    const THRUST = 260; // px/s²
    const DRAG = 0.987;
    if (keys['ArrowLeft']) this.angle -= ROT * dt;
    if (keys['ArrowRight']) this.angle += ROT * dt;
    this.thrusting = !!keys['ArrowUp'];
    if (this.thrusting) {
      this.vx += Math.cos(this.angle) * THRUST * dt;
      this.vy += Math.sin(this.angle) * THRUST * dt;
    }
    this.vx *= DRAG;
    this.vy *= DRAG;
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
  }
  tryShoot(): Bullet[] {
    if (this.shootCooldown > 0 || this.dead) return [];
    this.shootCooldown = 0.2;
    const NOSE = 21;
    const ox = this.x + Math.cos(this.angle) * NOSE;
    const oy = this.y + Math.sin(this.angle) * NOSE;
    if (this.tripleShot > 0)
      return [-SPREAD, 0, SPREAD].map(
        (d) => new Bullet(ox, oy, this.angle + d),
      );
    return [new Bullet(ox, oy, this.angle)];
  }
  draw(ctx: CanvasRenderingContext2D) {
    if (this.dead) return;
    // Parpadeo durante invencibilidad de reaparición
    if (this.invincible > 0 && Math.floor(this.invincible * 8) % 2 === 0)
      return;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    // Silueta clásica: triángulo con muesca trasera
    ctx.beginPath();
    ctx.moveTo(20, 0); // nariz
    ctx.lineTo(-12, -9); // ala izquierda
    ctx.lineTo(-7, 0); // muesca trasera
    ctx.lineTo(-12, 9); // ala derecha
    ctx.closePath();
    ctx.stroke();
    // Llama del propulsor
    if (this.thrusting && Math.random() > 0.35) {
      ctx.beginPath();
      ctx.moveTo(-8, -4);
      ctx.lineTo(-8 - rand(6, 14), 0);
      ctx.lineTo(-8, 4);
      ctx.strokeStyle = 'rgba(255, 130, 0, 0.85)';
      ctx.stroke();
    }
    ctx.restore();
  }
}
// ── Partículas (explosión) ────────────────────────────────────────────────────
class Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  ttl: number;
  dead = false;
  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
    const angle = rand(0, Math.PI * 2);
    const speed = rand(30, 130);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.life = rand(0.4, 1.1);
    this.ttl = this.life;
  }
  update(dt: number) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }
  draw(ctx: CanvasRenderingContext2D) {
    const alpha = this.ttl / this.life;
    ctx.strokeStyle = `rgba(255,255,255,${alpha.toFixed(2)})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x - this.vx * 0.05, this.y - this.vy * 0.05);
    ctx.stroke();
  }
}
// ── PowerUp (disparo triple) ──────────────────────────────────────────────────
class PowerUp {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius = 10;
  ttl = 8;
  dead = false;
  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
    const angle = rand(0, Math.PI * 2);
    this.vx = Math.cos(angle) * 30;
    this.vy = Math.sin(angle) * 30;
  }
  update(dt: number) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }
  draw(ctx: CanvasRenderingContext2D) {
    // Parpadeo durante los últimos 2 s
    if (this.ttl < 2 && Math.floor(this.ttl * 8) % 2 === 0) return;
    ctx.strokeStyle = '#0ff';
    ctx.fillStyle = '#0ff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('3', this.x, this.y + 4.5);
  }
}
// ── Motor ─────────────────────────────────────────────────────────────────────
type State = 'playing' | 'dead' | 'gameover';
export class AsteroidsEngine {
  private ctx: CanvasRenderingContext2D;
  private callbacks: EngineCallbacks;
  private keys: Keys = {};
  private justPressed: Keys = {};
  private ship = new Ship();
  private bullets: Bullet[] = [];
  private asteroids: Asteroid[] = [];
  private particles: Particle[] = [];
  private powerUp: PowerUp | null = null;
  private powerUpSpawned = false; // solo aparece una vez por nivel
  private score = 0;
  private lives = 3;
  private level = 1;
  private state: State = 'playing';
  private deadTimer = 0;
  private gameOverTimer = 0;
  private gameOverSent = false;
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
    this.initGame();
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
    // Evita un salto de dt y disparos acumulados al reanudar.
    this.lastTime = null;
    this.justPressed = {};
  }
  destroy() {
    this.started = false;
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
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
    if (this.paused) return;
    if (!this.keys[e.code]) this.justPressed[e.code] = true;
    this.keys[e.code] = true;
  };
  private onKeyUp = (e: KeyboardEvent) => {
    if (this.isTyping(e)) return;
    if (CONTROL_KEYS.includes(e.code)) e.preventDefault();
    this.keys[e.code] = false;
  };
  private pressed(code: string) {
    const val = this.justPressed[code];
    this.justPressed[code] = false;
    return !!val;
  }
  // ── Estado del juego ────────────────────────────────────────────────────────
  private spawnAsteroids(count: number) {
    const SAFE_DIST = 130;
    for (let i = 0; i < count; i++) {
      let x: number, y: number;
      do {
        x = rand(0, W);
        y = rand(0, H);
      } while (Math.hypot(x - W / 2, y - H / 2) < SAFE_DIST);
      this.asteroids.push(new Asteroid(x, y, 3));
    }
  }
  private initGame() {
    this.ship = new Ship();
    this.bullets = [];
    this.asteroids = [];
    this.particles = [];
    this.powerUp = null;
    this.powerUpSpawned = false;
    this.score = 0;
    this.lives = 3;
    this.level = 1;
    this.state = 'playing';
    this.spawnAsteroids(4);
  }
  private nextLevel() {
    this.level++;
    this.bullets = [];
    this.particles = [];
    this.powerUpSpawned = false; // un powerUp posible por nivel
    const triple = this.ship.tripleShot; // conservar el efecto entre niveles
    this.ship.reset();
    this.ship.tripleShot = triple;
    this.spawnAsteroids(3 + this.level);
  }
  private explode(x: number, y: number, count = 8) {
    for (let i = 0; i < count; i++) this.particles.push(new Particle(x, y));
  }
  private killShip() {
    this.explode(this.ship.x, this.ship.y, 14);
    this.ship.dead = true;
    this.lives--;
    if (this.lives <= 0) {
      this.state = 'gameover';
      this.gameOverTimer = GAME_OVER_DELAY;
    } else {
      this.state = 'dead';
      this.deadTimer = 2;
    }
  }
  // ── Update ──────────────────────────────────────────────────────────────────
  private updatePowerUp(dt: number) {
    if (!this.powerUp) return;
    this.powerUp.update(dt);
    if (this.powerUp.dead) this.powerUp = null;
  }
  private update(dt: number) {
    if (this.state === 'gameover') {
      this.particles.forEach((p) => p.update(dt));
      this.particles = this.particles.filter((p) => !p.dead);
      if (!this.gameOverSent) {
        this.gameOverTimer -= dt;
        if (this.gameOverTimer <= 0) {
          this.gameOverSent = true;
          this.callbacks.onGameOver(this.score);
        }
      }
      return;
    }
    if (this.state === 'dead') {
      this.deadTimer -= dt;
      this.particles.forEach((p) => p.update(dt));
      this.particles = this.particles.filter((p) => !p.dead);
      this.asteroids.forEach((a) => a.update(dt));
      this.updatePowerUp(dt);
      if (this.deadTimer <= 0) {
        this.state = 'playing';
        this.ship.reset();
      }
      return;
    }
    // Disparar
    if (this.pressed('Space')) {
      this.bullets.push(...this.ship.tryShoot());
    }
    this.ship.update(dt, this.keys);
    this.bullets.forEach((b) => b.update(dt));
    this.asteroids.forEach((a) => a.update(dt));
    this.particles.forEach((p) => p.update(dt));
    this.updatePowerUp(dt);
    // Recoger powerUp
    if (
      this.powerUp &&
      dist(this.ship, this.powerUp) < this.ship.radius + this.powerUp.radius
    ) {
      this.ship.tripleShot = TRIPLE_DURATION;
      this.explode(this.powerUp.x, this.powerUp.y, 6);
      this.powerUp = null;
    }
    this.bullets = this.bullets.filter((b) => !b.dead);
    this.particles = this.particles.filter((p) => !p.dead);
    // Bala vs asteroide
    const newAsteroids: Asteroid[] = [];
    for (const b of this.bullets) {
      for (const a of this.asteroids) {
        if (!a.dead && !b.dead && dist(b, a) < a.radius) {
          b.dead = true;
          a.dead = true;
          this.score += POINTS[a.size];
          this.explode(a.x, a.y, a.size * 5);
          if (!this.powerUpSpawned && Math.random() < POWERUP_CHANCE) {
            this.powerUp = new PowerUp(a.x, a.y);
            this.powerUpSpawned = true;
          }
          newAsteroids.push(...a.split());
        }
      }
    }
    this.asteroids = this.asteroids.filter((a) => !a.dead).concat(newAsteroids);
    this.bullets = this.bullets.filter((b) => !b.dead);
    // Nave vs asteroide
    if (this.ship.invincible <= 0) {
      for (const a of this.asteroids) {
        if (dist(this.ship, a) < this.ship.radius + a.radius * 0.82) {
          this.killShip();
          break;
        }
      }
    }
    // Nivel completado
    if (this.asteroids.length === 0) this.nextLevel();
  }
  // ── Draw ────────────────────────────────────────────────────────────────────
  private draw() {
    const { ctx } = this;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    this.particles.forEach((p) => p.draw(ctx));
    this.asteroids.forEach((a) => a.draw(ctx));
    this.bullets.forEach((b) => b.draw(ctx));
    if (this.powerUp) this.powerUp.draw(ctx);
    this.ship.draw(ctx);
  }
  // ── Stats ───────────────────────────────────────────────────────────────────
  private emitStats() {
    const stats: GameStats = {
      score: this.score,
      lives: this.lives,
      level: this.level,
      tripleLeft:
        this.ship.tripleShot > 0 ? Math.ceil(this.ship.tripleShot) : 0,
    };
    const last = this.lastStats;
    if (
      last &&
      last.score === stats.score &&
      last.lives === stats.lives &&
      last.level === stats.level &&
      last.tripleLeft === stats.tripleLeft
    )
      return;
    this.lastStats = stats;
    this.callbacks.onStats(stats);
  }
  // ── Loop principal ──────────────────────────────────────────────────────────
  private loop = (ts: number) => {
    if (!this.started) return;
    if (!this.paused) {
      const dt =
        this.lastTime === null
          ? 0
          : Math.min((ts - this.lastTime) / 1000, 0.05);
      this.lastTime = ts;
      this.update(dt);
      this.draw();
      this.emitStats();
    }
    this.rafId = requestAnimationFrame(this.loop);
  };
}
