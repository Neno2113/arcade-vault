# SPEC 08 — Bloque Buster (Arkanoid) como juego real con leaderboard

> **Status:** Implementado
> **Depends on:** SPEC 05, SPEC 06, SPEC 07
> **Date:** 2026-11-02
> **Objective:** Portar el Arkanoid de `../04-arkanoid` a un componente de Next.js que `GamePlayer` carga desde el registro para el id `bloque-buster`, reportando puntaje, vidas, nivel y fin de partida, con su puntaje en el leaderboard de Supabase.

---

## Por qué existe esta spec

Bloque Buster es el tercer juego real de la plataforma. El catálogo ya tiene la entrada `bloque-buster` (ARCADE, `cover-bricks`, cyan, `sort_order` 1), hoy simulada con puntos al azar. Esta spec la reemplaza por el Arkanoid de `../04-arkanoid/game.js` (471 líneas, globals, HUD y pantallas "GAME OVER" / "VICTORIA" dibujadas en el canvas, récord en `localStorage`, sprites de un spritesheet PNG y 2 sonidos), portado a TypeScript. La carpeta original no se modifica.

No existe `lib/games/bloque-buster/`, así que el motor se escribe desde cero a partir del original.

El contrato de SPEC 07 ya está generalizado (`GameStats.lives: number | null`, `extras?`, `onTogglePause?`, `initialLives` en `GameEntry`); esta spec no lo toca. Es el primer juego de la plataforma que depende de un asset de imagen (el spritesheet), cargado de forma asíncrona antes de arrancar el bucle.

---

## Alcance

**Dentro:**

- Asset: copia de `../04-arkanoid/assets/spritesheet-breakout.png` a `public/games/bloque-buster/spritesheet-breakout.png`. El original no se mueve ni se borra.
- Motor: `lib/games/bloque-buster/sprites.ts` (rectángulos del spritesheet y carga de la imagen), `lib/games/bloque-buster/levels.ts` (constantes, `LEVELS` y `buildBlocks`) y `lib/games/bloque-buster/engine.ts` (clase `BloqueBusterEngine` con `constructor(canvas, callbacks)`, `start()`, `setPaused()`, `destroy()`). Sin globals; solo pinta el mundo; el HUD y el "GAME OVER" los dibuja la plataforma; el motor no reinicia solo.
- Componente: `components/games/bloque-buster-game.tsx` (`"use client"`), patrón de `asteroids-game.tsx` y `caida-game.tsx`; el `<canvas>` lleva `style={{ imageRendering: 'pixelated' }}` como el original.
- Registro: entrada `bloque-buster` en `components/games/registry.ts` con `controls: '← → A D MOVER · ESPACIO LANZAR · P PAUSA'` e `initialLives: 3`.
- Catálogo: **sin migración**. La fila `bloque-buster` ya existe en `public.games` y su `long` describe el juego. `.cover-bricks` ya existe en `app/globals.css`.
- `.game-canvas` ya existe en `app/globals.css`; no se redefine (el `pixelated` va inline en el componente para no afectar a los demás juegos).

**Leaderboard:** sin cambios de esquema ni de código. `scores`, `game_stats`, `top_scores`, `saveScore`, `/juegos/[id]` y `/salon` operan sobre cualquier `id` de `games`; aquí solo se verifica que el puntaje de `bloque-buster` se guarda y aparece.

**Fuera de alcance (specs futuras):**

- Sonido (`ball-bounce.mp3`, `break-sound.mp3`): va en una spec transversal de la plataforma (autoplay, silencio).
- Récord local en `localStorage` (`arkanoid:v1:highScore`) y su visualización: el ranking real es el de Supabase.
- Pantalla de título (`status: 'start'`): la plataforma ya tiene portada y botón JUGAR.
- Selector de nivel con teclas `1`–`3` en pausa: era una ayuda de pruebas del original (sin spec propia allí) y permitiría puntajes falsos.
- Pausar con `Escape`: solo `P` y el botón PAUSA.
- Mensaje o modal distinto para la victoria ("¡VICTORIA!"): ganar y perder abren el mismo modal "FIN DEL JUEGO".
- Bloques de varios golpes (el color `gray` del spritesheet no se usa), power-ups y nuevos niveles: el original los lista como pendientes.
- Controles táctiles y móvil: bajo 768 px el canvas se escala pero se controla con teclado.
- Manejo de `devicePixelRatio` (resolución lógica fija 960×720).
- Anti-trampa: el puntaje lo envía el navegador y es falsificable (ver SPEC 06).
- Tests automatizados (no hay runner configurado).
- Migrar los demás juegos simulados.
- Modificar o borrar `../04-arkanoid`.

---

## Modelo de datos

No se introducen datos persistentes ni migraciones.

```ts
// lib/games/bloque-buster/engine.ts
export class BloqueBusterEngine {
  constructor(canvas: HTMLCanvasElement, callbacks: EngineCallbacks);
  start(): void; // carga el spritesheet, emite onStats inicial, inicia rAF y listeners de teclado
  setPaused(paused: boolean): void;
  destroy(): void; // cancela rAF, el temporizador de fin, la carga pendiente y quita todos los listeners
}
```

```ts
// lib/games/bloque-buster/sprites.ts
export type Frame = { sx: number; sy: number; sw: number; sh: number };
export const SPRITES: {
  paddle: Frame;
  ball: Frame;
  blocks: Record<BlockColor, Frame>;
};
export const EXPLOSION_FRAMES: Record<BlockColor, Frame[]>; // 4 frames por color
export const EXPLOSION_DURATION = 150; // ms
export function loadSpritesheet(): Promise<CanvasImageSource>; // rechaza si el PNG no carga
```

```ts
// lib/games/bloque-buster/levels.ts
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
export const LEVELS: Level[]; // 3 niveles
export function buildBlocks(level: number): Block[]; // level es 1–3
```

### Constantes (mismos nombres y valores que el original)

Los valores de `sprites.ts` (rectángulos de `SPRITES`, `EXPLOSION_FRAMES`) se copian tal cual de `../04-arkanoid/assets/spritesheet.js`.

| Constante                                             | Valor                                                                                                       |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `WIDTH`, `HEIGHT`                                     | `960`, `720` (4:3; se conserva la resolución del original, no 800×600)                                      |
| `MAX_DT`                                              | `1 / 30` s (el original; evita que la pelota atraviese bloques con un `dt` grande)                          |
| `BLOCK_COLORS`                                        | `['red', 'yellow', 'cyan', 'magenta', 'hotpink', 'green']`; el color de la fila es `BLOCK_COLORS[fila % 6]` |
| `BLOCK_COLS`, `BLOCK_W`, `BLOCK_H`                    | `16`, `60`, `28`                                                                                            |
| `BLOCKS_TOP`                                          | `100` (se conserva aunque el HUD ya no se dibuje en el canvas, para no alterar la física ni el nivel)       |
| Paleta (`paddle`)                                     | `w 140`, `h 18`, `speed 650` px/s, `x` inicial centrada, `y = HEIGHT - 50`                                  |
| Pelota (`ball`)                                       | `r 10`                                                                                                      |
| `POINTS_PER_BLOCK`                                    | `10`                                                                                                        |
| `SPEED_STEP`, `MAX_SPEED_FACTOR`                      | `0.01` (sobre la velocidad inicial del nivel, por bloque roto), `2`                                         |
| `LAUNCH_ANGLE`, `MAX_BOUNCE_ANGLE`                    | `Math.PI / 8`, `Math.PI / 3`                                                                                |
| `LEVEL_TRANSITION_MS`                                 | `2000`                                                                                                      |
| `PARTICLE_COUNT`, `PARTICLE_LIFE_MS`                  | `8`, `400`                                                                                                  |
| `PARTICLE_SPEED`, `PARTICLE_GRAVITY`, `PARTICLE_SIZE` | `140` px/s, `400` px/s², `4` px                                                                             |
| `PARTICLE_COLORS`                                     | `red #c02a3e`, `yellow #d9bd4c`, `cyan #4fc99c`, `magenta #632ff4`, `hotpink #fc7d1c`, `green #44aaf3`      |
| `GAME_OVER_DELAY`                                     | `1.2` s (propia del port, igual que en Asteroids y Caída)                                                   |

`LEVELS` (patrón de 16 columnas por fila, `#` bloque, `.` hueco, `CHECKER_A = '#.#.#.#.#.#.#.#.'`, `CHECKER_B = '.#.#.#.#.#.#.#.#'`, `FULL_ROW = '################'`):

| Nivel | `ballSpeed` | Patrón                                      | Bloques |
| ----- | ----------- | ------------------------------------------- | ------- |
| 1     | `480`       | 6 × `FULL_ROW`                              | 96      |
| 2     | `600`       | 6 filas alternando `CHECKER_A`, `CHECKER_B` | 48      |
| 3     | `720`       | `A, B, A, B` + 4 × `FULL_ROW`               | 96      |

### Estados internos

`'ready' | 'playing' | 'levelcomplete' | 'gameover' | 'won'`. Se omite `'start'` y `'paused'` del original: la pausa es de `GamePlayer` (prop `paused`) y no hay pantalla de título.

- `ready`: la pelota sigue a la paleta; Espacio la lanza (`launchBall`: lado aleatorio, `LAUNCH_ANGLE` desde la vertical, velocidad del nivel) y pasa a `playing`. El motor arranca en `ready`.
- `playing` → `levelcomplete` al no quedar bloques vivos en los niveles 1 y 2; → `won` al limpiar el nivel 3; → `ready` (pelota pegada a la paleta) al caer la pelota con vidas restantes; → `gameover` al perder la última vida.
- `levelcomplete`: cuenta atrás de `LEVEL_TRANSITION_MS`; luego `level += 1`, `buildBlocks`, velocidad del nivel nuevo y `ready`. Explosiones y partículas siguen animándose.
- `gameover` / `won`: el motor ignora el teclado, mantiene explosiones y partículas, y a los `GAME_OVER_DELAY` segundos emite `onGameOver(score)` una sola vez.

### Evento → puntos

| Evento                     | Puntos / efecto                                                    |
| -------------------------- | ------------------------------------------------------------------ |
| Romper un bloque           | +10 y la pelota acelera `+ballSpeed × 0,01` (tope `ballSpeed × 2`) |
| Rebote en paredes o paleta | 0                                                                  |
| Perder la pelota           | −1 vida, 0 puntos                                                  |
| Limpiar un nivel o ganar   | 0 (no hay bonus)                                                   |

Máximo teórico por partida: (96 + 48 + 96) × 10 = 2.400, muy por debajo del límite de `saveScore`.

### Física (portada tal cual)

- Rebote en paredes izquierda, derecha y techo; cae por `y - r > HEIGHT`.
- Paleta: rebota solo con `vy > 0`; el ángulo es `hit × MAX_BOUNCE_ANGLE`, con `hit` de −1 (borde izquierdo) a 1 (borde derecho).
- Bloques: colisión círculo-rectángulo con el punto más cercano; un solo bloque por fotograma; rebota en el eje de mayor penetración y saca la pelota del bloque.
- La velocidad del nivel nuevo se reinicia en `startNextLevel`, `launchBall` y tras perder una vida (la velocidad acumulada del nivel se pierde al lanzar, como en el original).

### Stats que reporta

- `score`: puntaje acumulado.
- `lives`: `3` al empezar, baja al perder la pelota.
- `level`: `1`–`3`; sube al terminar la transición, no al limpiar el nivel.
- `extras`: no se usa.

`onStats` se emite una vez en `start()` y luego solo cuando cambia `score`, `lives` o `level`. Nunca por frame.

### Teclado

| Tecla                | Acción                             | ¿Repite al mantener?      |
| -------------------- | ---------------------------------- | ------------------------- |
| `ArrowLeft`, `KeyA`  | Mover la paleta a la izquierda     | Sí (estado continuo)      |
| `ArrowRight`, `KeyD` | Mover la paleta a la derecha       | Sí (estado continuo)      |
| `Space`              | Lanzar la pelota (solo en `ready`) | No (se ignora `e.repeat`) |
| `KeyP`               | Llama a `onTogglePause`            | No (se ignora `e.repeat`) |

El movimiento usa un `Set` de teclas pulsadas, como el original, que se vacía en `blur` de la ventana y al pausar para que la paleta no quede "pegada".

### Convenciones

- Render sobre el canvas de 960×720: fondo transparente sobre el fondo del `.crt` (el original usa `clearRect`); sprites del spritesheet con `drawImage`; pelota, paleta y bloques escalados al tamaño de las constantes.
- El canvas pinta el mundo: bloques, explosiones, partículas, paleta, pelota, el rótulo `NIVEL N` durante `levelcomplete` (sobre un velo `rgba(0,0,0,0.5)`) y, en `ready`, el texto `ESPACIO PARA LANZAR` bajo la paleta. El HUD (PUNTOS, RÉCORD, vidas, "Nivel N/3"), las pantallas de pausa, "GAME OVER" y "VICTORIA" del original **no** se dibujan en el canvas.
- Los textos del canvas usan `monospace` como el original, en español.
- El motor no arranca el bucle hasta que `loadSpritesheet()` resuelve. Si `destroy()` se llama antes, la promesa resuelta se ignora. Si el PNG falla, se hace `console.error` y no se inicia el bucle (el reproductor queda vacío, caso aceptado porque el asset es local).
- `GamePlayer` ya ofrece FIN para terminar la partida a mano; el motor no necesita ese camino.
- Con `paused` activo el motor congela simulación y dibujo, ignora todas las teclas **excepto** `KeyP`, y al reanudar reinicia `lastTime`. `dt` se limita a `MAX_DT`.
- `preventDefault` sobre `ArrowLeft`, `ArrowRight` y `Space` (en `keydown` y `keyup`) solo mientras el motor esté montado y el foco no esté en un `input` o `textarea`. `KeyA`, `KeyD` y `KeyP` tampoco se procesan con el foco en un `input` o `textarea`, para que el campo de iniciales del modal acepte esas letras.
- `Math.random` solo dentro del motor, que se crea en un efecto. Nunca durante el render.
- Textos de UI en español.

---

## Plan de implementación

Cada paso deja el sistema funcional y es commiteable por sí solo. Antes de escribir código de Next, leer en `node_modules/next/dist/docs/` la guía de componentes cliente, la de archivos estáticos en `public/` y la interacción con `cacheComponents` (según `AGENTS.md`; el reproductor ya renderiza `GamePlayer` dentro de `Suspense`). Usar `/frontend-design` para el trabajo de UI (según `CLAUDE.md`): aquí aplica a los rótulos `NIVEL N` y `ESPACIO PARA LANZAR` del canvas, a la barra de controles y a cómo se ve el `pixelated` dentro del `.crt`.

1. Assets y sprites: copiar el PNG a `public/games/bloque-buster/spritesheet-breakout.png` y crear `lib/games/bloque-buster/sprites.ts` (`SPRITES`, `EXPLOSION_FRAMES`, `EXPLOSION_DURATION`, `loadSpritesheet()` con ruta `/games/bloque-buster/spritesheet-breakout.png`). Verificar: `npx tsc --noEmit`, `npm run lint` y `/games/bloque-buster/spritesheet-breakout.png` responde 200 en `npm run dev`.
2. Niveles: crear `lib/games/bloque-buster/levels.ts` con las constantes de bloques, `LEVELS`, `BlockColor`, `Block` y `buildBlocks(level)`. Verificar: `npx tsc --noEmit` y `npm run lint`; `buildBlocks(1).length === 96`, `buildBlocks(2).length === 48`, `buildBlocks(3).length === 96` (comprobable con un `tsx` o `console.log` temporal que no se commitea).
3. Motor, lógica: crear `lib/games/bloque-buster/engine.ts` con la clase y el estado (`status`, `score`, `lives`, `level`, `ball`, `paddle`, `blocks`, `particles`), y los métodos privados `stickBallToPaddle`, `launchBall`, `updateBall`, `bounceOnPaddle`, `bounceOnBlocks`, `speedUpBall`, `loseLife`, `startNextLevel`, `spawnParticles`, `update(dt)`, `emitStats` (solo ante cambios) y el temporizador de `onGameOver`. Verificar: `npx tsc --noEmit` y `npm run lint`.
4. Motor, ciclo de vida y dibujo: en `engine.ts` añadir `start()` (espera `loadSpritesheet()`, emite stats iniciales, inicia rAF con `MAX_DT`), `draw()` (bloques y explosiones, partículas, paleta, pelota, rótulos `NIVEL N` y `ESPACIO PARA LANZAR`), `setPaused()` con reinicio de `lastTime` y `destroy()` (cancela rAF, temporizador y marca la carga pendiente como descartada). Verificar: `npx tsc --noEmit`.
5. Motor, teclado: en `engine.ts` añadir los listeners de `keydown`/`keyup`/`blur` según la tabla "Teclado": `Set` de teclas, `preventDefault` condicionado al foco, filtro de `e.repeat`, `KeyP` activo incluso en pausa, y limpieza en `destroy()`. Verificar: `npx tsc --noEmit` y `npm run lint`.
6. Crear `components/games/bloque-buster-game.tsx` (`"use client"`): `<canvas className="game-canvas" width={960} height={720} style={{ imageRendering: 'pixelated' }}>`, un efecto por `runId` que crea `new BloqueBusterEngine(...)`, llama a `start()` y limpia con `destroy()`, un efecto para `paused`, y refs de callbacks incluyendo `onTogglePause`. Verificar: `npx tsc --noEmit`.
7. Registrar `bloque-buster` en `components/games/registry.ts` (`Component: BloqueBusterGame`, `controls` de la sección Alcance, `initialLives: 3`). Verificar: `/juegos/bloque-buster/jugar` monta el canvas con 96 bloques, la paleta y la pelota pegada a ella, el HUD muestra Puntuación 0, Vidas `♥ ♥ ♥` y Nivel 1, y la barra inferior muestra los controles completos a 1280 px y bajo 768 px.
8. Verificación manual en `npm run dev` (puede hacerse con el MCP de Playwright): lanzar con Espacio, romper bloques y confirmar +10 por bloque en el HUD; dejar caer la pelota 3 veces sin mover la paleta para llegar al fin, comprobar el modal, guardar el puntaje, comprobar con `execute_sql` la fila en `scores` y que aparece en `/juegos/bloque-buster` y `/salon`; probar `P`, PAUSA, FIN y "JUGAR DE NUEVO"; confirmar con `execute_sql` que `select count(*) from public.games where id = 'bloque-buster'` devuelve 1 y con `list_migrations` que no hay migración nueva. Para ver la transición de nivel y la victoria sin jugar a mano, ayudarse temporalmente del MCP de Playwright (`browser_evaluate`) sin modificar el código; no se commitea ningún atajo. Luego `npm run build`.

---

## Criterios de aceptación

- [x] `npm run build`, `npm run lint` y `npx tsc --noEmit` terminan sin errores.
- [x] `public/games/bloque-buster/spritesheet-breakout.png` existe, es idéntico al de `../04-arkanoid/assets/` (mismo hash) y responde 200.
- [x] `/juegos/bloque-buster/jugar` muestra el canvas 960×720 dentro del `.crt` con relación 4:3, 96 bloques de seis colores en seis filas completas desde `y = 100`, la paleta centrada abajo, la pelota pegada a ella, y el texto `ESPACIO PARA LANZAR`.
- [x] El HUD de `bloque-buster` muestra Puntuación, Vidas (`♥ ♥ ♥`) y Nivel, sin ningún stat extra; el HUD de React es el único HUD (el canvas no dibuja PUNTOS, RÉCORD ni vidas).
- [x] ← → y A D mueven la paleta sin salirse del canvas; Espacio lanza la pelota solo en `ready`; la página no hace scroll con las flechas ni con Espacio mientras se juega.
- [x] Mantener Espacio no relanza la pelota tras perder una vida (se exige una pulsación nueva por `e.repeat`).
- [x] Romper un bloque suma exactamente 10 puntos y el valor aparece en el HUD de React; rebotar en paredes o paleta no suma.
- [x] Al perder la pelota con vidas restantes, Vidas baja en 1, la pelota vuelve pegada a la paleta, y la velocidad vuelve a la inicial del nivel.
- [x] Al limpiar el nivel 1 aparece el rótulo `NIVEL 2` en el canvas ~2 s, luego aparecen 48 bloques en damero, Nivel pasa a 2 en el HUD y la partida queda en `ready`. Lo mismo del 2 al 3 con 96 bloques.
- [x] La velocidad inicial de la pelota es 480 / 600 / 720 px/s en los niveles 1 / 2 / 3 y no supera el doble de ese valor.
- [x] Al perder la última vida, o al limpiar el nivel 3, ~1,2 s después se abre el modal "FIN DEL JUEGO" con la puntuación final correcta, una sola vez; no aparece ningún overlay "GAME OVER" ni "VICTORIA" dentro del canvas.
- [x] `P` pausa y reanuda (overlay "EN PAUSA"); el botón PAUSA hace lo mismo; con el modal abierto `P` no pausa nada; `Escape` no pausa; las teclas `1`–`3` en pausa no cambian de nivel.
- [x] Pausar y reanudar no produce salto de la pelota ni de la paleta, y soltar una flecha durante la pausa no deja la paleta moviéndose al reanudar.
- [x] El campo de iniciales del modal acepta espacios y las letras `P`, `A` y `D` sin que el juego reaccione ni la página haga scroll.
- [x] "GUARDAR PUNTUACIÓN" crea una fila en `scores` con `game_id = 'bloque-buster'`, el nombre escrito, la puntuación del HUD y `user_id` nulo, y muestra `▸ PUNTUACIÓN GUARDADA_`.
- [x] Tras guardar, `/juegos/bloque-buster` y `/salon` muestran el puntaje al navegar a ellas sin reiniciar el servidor, y `Puntuaciones` aumenta en 1.
- [x] "JUGAR DE NUEVO" arranca una partida limpia (puntaje 0, 3 vidas, nivel 1, 96 bloques, pelota pegada); FIN abre el modal con el puntaje actual; SALIR navega sin errores en consola.
- [x] Al salir de la ruta, o al pulsar "JUGAR DE NUEVO" varias veces seguidas, no quedan listeners de teclado, ni `requestAnimationFrame`, ni el temporizador de fin activos, y no hay dos bucles simultáneos (las flechas, Espacio y `P` recuperan su comportamiento normal en otras pantallas).
- [x] `/biblioteca` y `/` muestran `bloque-buster` en su posición (`sort_order` 1) con su `long` actual, `select count(*) from public.games where id = 'bloque-buster'` devuelve 1 y no se creó ninguna migración.
- [x] `rocas`, `caida` y los juegos simulados (p. ej. `/juegos/serpentina/jugar`) funcionan igual que antes.
- [x] No hay errores en consola ni advertencias de hidratación en `/juegos/bloque-buster/jugar`.
- [x] `../04-arkanoid` queda sin cambios (`git status` en esa carpeta no muestra modificaciones).

---

## Decisiones tomadas y descartadas

- **Sí:** reutilizar la entrada `bloque-buster` del catálogo. Ya es el Arkanoid del catálogo (ARCADE, `cover-bricks`, `long` acorde) y conserva ruta, portada y ranking; evita una entrada duplicada y una migración.
- **No:** reescribir el `long` en una migración. El texto actual (paleta, núcleo, muros, niveles con patrones) encaja con el juego.
- **Sí:** motor como clase TS con `destroy()`, sin globals. React 19 en modo estricto monta, desmonta y vuelve a montar efectos; los globals del original romperían el reinicio.
- **Sí:** registro `id → componente`; `GamePlayer` sigue siendo el contenedor común (pausa, modal, guardado).
- **Sí:** resolución lógica 960×720, la del original. El `.crt` ya escala cualquier canvas 4:3, y así todas las constantes (bloques, velocidades, paleta) se portan sin conversión ni riesgo de alterar la física.
- **No:** reescalar a 800×600. Obligaba a recalcular cada constante de física sin ganancia visible.
- **Sí:** spritesheet copiado a `public/games/bloque-buster/`. Es fiel al original y mantiene las explosiones animadas. **No:** formas planas neón (se aparta del original).
- **Sí:** `image-rendering: pixelated` inline en el `<canvas>` del juego. **No:** añadirlo a `.game-canvas`, que afectaría a Asteroides y Caída (vectoriales y planos).
- **Sí:** el motor espera `loadSpritesheet()` antes de iniciar el bucle y descarta la carga si ya se destruyó. Evita dibujar con la imagen sin cargar y sobrevivir al montaje doble de modo estricto.
- **Sí:** sin pantalla de título; el motor arranca en `ready`. La plataforma ya tiene portada y el botón JUGAR.
- **Sí:** conservar `ready` tras cada vida perdida, con el texto `ESPACIO PARA LANZAR` dibujado en el canvas. Es parte del flujo de juego del original, no del HUD. **No:** lanzar la pelota automáticamente (cambiaría la jugabilidad).
- **Sí:** dibujar `NIVEL N` en el canvas durante `levelcomplete`. Es una transición del mundo del juego, no un dato del HUD.
- **Sí:** victoria al limpiar el nivel 3 termina con `onGameOver(score)`, igual que perder. **No:** bucle infinito de niveles (se aparta del original) ni cambiar el contrato con un `onWin`.
- **Sí:** `level` del HUD sube al terminar la transición, no al limpiar el nivel, igual que `game.level` del original.
- **Sí:** `MAX_DT = 1/30` en lugar del 0,05 s de las demás specs. A 720 px/s con la velocidad acelerada, 0,05 s mueve la pelota 72 px, más que el alto de un bloque (28 px), y la haría atravesarlos. Es un valor del original, no una desviación.
- **Sí:** `BLOCKS_TOP = 100` aunque el HUD ya no se dibuje en el canvas. Conserva la disposición y la física del original; recortar ese margen es un cambio de diseño posterior.
- **Sí:** `onStats` solo ante cambios, no por frame, para no re-renderizar `GamePlayer` 60 veces por segundo.
- **Sí:** sin `extras`. El nivel ya está en el HUD y el récord local lo sustituye el ranking de Supabase.
- **Sí:** el sonido queda fuera de alcance, como en Asteroides y Caída. **No:** copiar los mp3 sin una política común de audio.
- **Sí:** pausa solo con `P` y el botón PAUSA. **No:** `Escape` ni el selector de nivel `1`–`3` de la pausa: el selector se añadió al original como ayuda de pruebas, sin spec, y permitiría puntajes falsos.
- **Sí:** teclado con `Set` de teclas (movimiento continuo) y `blur` que lo vacía. Evita la paleta atascada al cambiar de pestaña o abrir el modal con una flecha pulsada.
- **Sí:** el puntaje se guarda con la Server Action `saveScore` existente. **No:** tabla o columna propia por juego.
- **Sí:** `Math.random` solo dentro del motor, que se crea en un efecto. Nunca durante el render.
- **Sí:** `sprites.ts` y `levels.ts` separados de `engine.ts`, para revisar los datos del spritesheet y los niveles aparte del bucle.

---

## Riesgos identificados

| Riesgo                                                                                         | Mitigación                                                                                                                              |
| ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Listeners, `requestAnimationFrame` o el temporizador de fin quedan activos tras desmontar      | `destroy()` los limpia; criterio de aceptación específico.                                                                              |
| `destroy()` antes de que el spritesheet cargue deja un bucle huérfano (modo estricto)          | Bandera `destroyed`: al resolver la promesa se comprueba antes de iniciar rAF y listeners; criterio de "no hay dos bucles simultáneos". |
| El PNG no carga (ruta de `public/` errónea)                                                    | El paso 1 verifica el 200 de la URL antes de escribir el motor; el motor hace `console.error` y no arranca.                             |
| Espacio activa el botón PAUSA enfocado o hace scroll                                           | `preventDefault` en `keydown` y `keyup` de las teclas de control mientras se juega; verificar en el paso 8.                             |
| Capturar teclas rompe el campo de iniciales (`A`, `D`, `P`)                                    | No procesar ni hacer `preventDefault` con foco en `input`/`textarea`; `onTogglePause` ignora `over`; criterio de aceptación específico. |
| `P` pausa por el motor y el botón PAUSA queda desincronizado                                   | El motor solo llama a `onTogglePause`; `GamePlayer` es el único dueño de `paused`.                                                      |
| Paleta atascada si se suelta una tecla durante pausa, `blur` o modal                           | Vaciar el `Set` de teclas en `blur` y en `setPaused(true)`; criterio de aceptación específico.                                          |
| La pelota atraviesa bloques con un `dt` grande tras cambiar de pestaña                         | `MAX_DT = 1/30` y `lastTime` reiniciado al reanudar.                                                                                    |
| Desajuste de hidratación                                                                       | Canvas y motor se crean solo en efectos; `Math.random` solo dentro del motor; `initialLives: 3` evita que "Vidas" cambie tras hidratar. |
| El texto `controls` (más largo que el de Asteroides) se corta en la barra inferior del `.crt`  | Revisar en el paso 7 a 1280 px y bajo 768 px; si se corta, abreviarlo con `/frontend-design` sin cambiar las teclas.                    |
| El canvas con `pixelated` se ve distinto en el `.crt` (escalado no entero)                     | Revisarlo con `/frontend-design` en el paso 7; si se ve mal, valorar quitar `pixelated` y registrarlo en Decisiones.                    |
| El original contradice su propio README o CLAUDE.md (SPEC 01 mencionaba 480×640 y 10 columnas) | Fuente de verdad: `game.js` (960×720, 16 columnas, bloques 60×28).                                                                      |

---

## Lo que **no** está en esta spec

- Sonido ni política de audio de la plataforma.
- Récord local en `localStorage`, pantalla de título y menú de pausa propio.
- Selector de nivel, pausa con `Escape` y cualquier atajo de pruebas.
- Mensaje o pantalla propia de victoria, ni cambios al contrato (`onWin`).
- Bloques de varios golpes (`gray`), power-ups, más niveles o cambios de reglas respecto a `game.js`.
- Controles táctiles, soporte móvil y `devicePixelRatio`.
- Anti-trampa, rate limit o puntajes firmados por el motor.
- Tests automatizados.
- Migrar los otros 5 juegos simulados (Serpentina, Glotón, Invasores, Ranaria, Duelo Píxel).
- Cambios de esquema o de código del leaderboard.
- Modificar o borrar `../04-arkanoid`.

Cada uno, si se aborda, va en su propia spec.
