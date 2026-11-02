# SPEC 07 — Caída (Tetris) como juego real con leaderboard

> **Status:** Implementado
> **Depends on:** SPEC 05, SPEC 06
> **Date:** 2026-10-29
> **Objective:** Portar el Tetris de `../03-tetris` a un componente de Next.js que `GamePlayer` carga desde el registro para el id `caida`, reportando puntaje, nivel, líneas y fin de partida, con su puntaje en el leaderboard de Supabase.

---

## Por qué existe esta spec

Caída es el segundo juego real de la plataforma. El catálogo ya tiene la entrada `caida` (PUZZLE, `cover-tetro`, magenta, `sort_order` 2), hoy simulada con puntos al azar. Esta spec la reemplaza por el Tetris de `../03-tetris/game.js` (305 líneas, `'use strict'`, estado en globals, HUD y "GAME OVER" en el DOM, reinicio con un botón), portado a TypeScript. La carpeta original no se modifica.

No existe `lib/games/caida/`, así que el motor se escribe desde cero a partir del original.

Esta es también **la spec que generaliza el contrato** de SPEC 05. `GameStats` todavía tiene `tripleLeft`, un campo exclusivo de Asteroids, y Tetris necesita lo contrario: no tiene vidas y sí un contador de líneas. Además, el original se pausa con `P`, así que el contrato gana un callback opcional para pedir la pausa a la plataforma. Ambos cambios dejan `rocas` funcionando igual.

---

## Alcance

**Dentro:**

- Contrato (`components/games/types.ts`): `GameStats` con `lives: number | null` y `extras?: GameStat[]` en lugar de `tripleLeft`; `GameProps` gana `onTogglePause?: () => void`; `EngineCallbacks` se mueve aquí desde `lib/games/asteroids/engine.ts` y gana `onTogglePause?`.
- `components/game-player.tsx`: pinta `extras` como `.hud-stat`, oculta "Vidas" si `lives` es `null`, pasa `onTogglePause` al juego, y toma las vidas iniciales de la entrada del registro.
- `lib/games/asteroids/engine.ts`: `tripleLeft` pasa a `extras: [{ label: 'Triple', value: 'Ns' }]`, solo mientras esté activo. `rocas` no cambia visualmente.
- `components/games/registry.ts`: `GameEntry` gana `initialLives: number | null` (`rocas: 3`, `caida: null`) para que el primer render ya sea correcto y "Vidas" no parpadee.
- Motor: `lib/games/caida/pieces.ts` (constantes y funciones puras) y `lib/games/caida/engine.ts` (clase `CaidaEngine` con `constructor(canvas, callbacks)`, `start()`, `setPaused()`, `destroy()`). Sin globals; solo pinta el mundo; el HUD y el "GAME OVER" los dibuja la plataforma; el motor no reinicia solo.
- Componente: `components/games/caida-game.tsx` (`"use client"`), patrón de `asteroids-game.tsx`.
- Registro: entrada `caida` en `components/games/registry.ts` con `controls: '← → MOVER · ↓ BAJAR · ↑ X ROTAR · ESPACIO CAÍDA · P PAUSA'`.
- Catálogo: **sin migración**. La fila `caida` ya existe en `public.games` y su `long` (rotar, limpiar líneas, velocidad cada 10 líneas) describe el juego. `.cover-tetro` ya existe en `app/globals.css`.
- `.game-canvas` ya existe en `app/globals.css`; no se redefine.

**Leaderboard:** sin cambios de esquema ni de código. `scores`, `game_stats`, `top_scores`, `saveScore`, `/juegos/[id]` y `/salon` operan sobre cualquier `id` de `games`; aquí solo se verifica que el puntaje de `caida` se guarda y aparece.

**Fuera de alcance (specs futuras):**

- Menú de pausa propio con opciones (reanudar, reiniciar, ver controles) del `requirenments.md` original: la plataforma ya tiene PAUSA, "JUGAR DE NUEVO" y la barra de controles.
- Selector de nivel inicial.
- Records locales en `localStorage` y mejor combo / máximo de líneas: el ranking real es el de Supabase.
- Skins o temas visuales.
- Rotación SRS, bolsa de 7 piezas, "hold" y puntos por combo: el original usa piezas aleatorias puras y patadas horizontales simples.
- Pausar con `Escape` (el `requirenments.md` lo menciona; solo se usa `P`).
- Controles táctiles y móvil: bajo 768 px el canvas se escala pero se controla con teclado.
- Sonido y música.
- Manejo de `devicePixelRatio` (resolución lógica fija 800×600).
- Anti-trampa: el puntaje lo envía el navegador y es falsificable (ver SPEC 06).
- Tests automatizados (no hay runner configurado).
- Migrar los demás juegos simulados.
- Modificar o borrar `../03-tetris`.

---

## Modelo de datos

No se introducen datos persistentes ni migraciones. Tipos y contrato tras el cambio:

```ts
// components/games/types.ts
export type GameStat = { label: string; value: string };
export type GameStats = {
  score: number;
  lives: number | null; // null = el juego no tiene vidas
  level: number;
  extras?: GameStat[]; // stats propios del juego, el HUD los pinta genéricos
};
export type EngineCallbacks = {
  onStats: (stats: GameStats) => void;
  onGameOver: (score: number) => void;
  /** El jugador pidió pausar o reanudar con el teclado; la decisión es de la plataforma. */
  onTogglePause?: () => void;
};
export type GameProps = {
  paused: boolean;
  runId: number;
  onStats: (stats: GameStats) => void;
  onGameOver: (score: number) => void;
  onTogglePause?: () => void;
};
```

```ts
// components/games/registry.ts
export type GameEntry = {
  Component: ComponentType<GameProps>;
  controls: string;
  initialLives: number | null; // vidas del primer render, antes del primer onStats
};
```

```ts
// lib/games/caida/engine.ts
export class CaidaEngine {
  constructor(canvas: HTMLCanvasElement, callbacks: EngineCallbacks);
  start(): void; // emite onStats inicial, inicia rAF y listeners de teclado
  setPaused(paused: boolean): void;
  destroy(): void; // cancela rAF, el temporizador de fin y quita todos los listeners
}
```

### Constantes (en `lib/games/caida/pieces.ts`, mismos nombres y valores que el original)

| Constante      | Valor                                                                                                  |
| -------------- | ------------------------------------------------------------------------------------------------------ |
| `COLS`, `ROWS` | `10`, `20`                                                                                             |
| `BLOCK`        | `30` (tablero de 300×600 px)                                                                           |
| `COLORS`       | `null` + `#4dd0e1` I, `#ffd54f` O, `#ba68c8` T, `#81c784` S, `#e57373` Z, `#7986cb` J, `#ffb74d` L     |
| `PIECES`       | Las 7 matrices del original (I 4×4; O 2×2; T, S, Z, J, L 3×3); las celdas no nulas valen el índice 1–7 |
| `LINE_SCORES`  | `[0, 100, 300, 500, 800]`                                                                              |
| `KICKS`        | `[0, -1, 1, -2, 2]` (patadas horizontales al rotar)                                                    |

Nuevas, propias del port: `W = 800`, `H = 600`, `BOARD_X = 250` (tablero centrado), `NEXT_X = 590`, `NEXT_Y = 40` (panel "SIGUIENTE" de 120×120 a la derecha), `GAME_OVER_DELAY = 1.2` (segundos), `MAX_DT = 0.05` (segundos).

### Reglas portadas tal cual

- Pieza nueva: aleatoria uniforme entre las 7 (`Math.random`, sin bolsa), en `x = floor(COLS / 2) - floor(ancho / 2)`, `y = 0`. Se mantiene la pieza siguiente (`next`).
- Gravedad: la pieza baja una fila cada `dropInterval` ms; si no puede bajar, se fija. `dropInterval = max(100, 1000 - (nivel - 1) * 90)`. El acumulador solo se reinicia cuando dispara la gravedad, como en el original.
- Rotación horaria con patadas `KICKS`; si ninguna cabe, no rota.
- Fin de partida: la pieza nueva colisiona en su posición de aparición.
- Nivel: `floor(líneas / 10) + 1`, sin tope.
- Pieza fantasma: la sombra de aterrizaje se dibuja con opacidad 0,2.

### Evento → puntos

| Evento                              | Puntos                                             |
| ----------------------------------- | -------------------------------------------------- |
| ↓ con espacio para bajar una fila   | +1                                                 |
| ↓ sin espacio (la pieza se fija)    | 0 directos                                         |
| Espacio (caída directa)             | +2 por cada fila recorrida                         |
| Gravedad                            | 0                                                  |
| Limpiar 1, 2, 3 o 4 líneas a la vez | `LINE_SCORES[n] × nivel` (100/300/500/800 × nivel) |

El nivel que multiplica es el vigente **antes** de recalcularlo con las líneas recién limpiadas, igual que el original.

### Stats que reporta

- `score`: puntaje acumulado.
- `lives`: siempre `null` (Tetris no tiene vidas; "Vidas" no se muestra).
- `level`: nivel vigente.
- `extras`: `[{ label: 'Líneas', value: String(líneas) }]`.

`onStats` se emite una vez en `start()` (estado inicial) y luego solo cuando cambia `score`, `level` o `líneas`. Nunca por frame.

### Teclado

| Tecla             | Acción                            | ¿Repite al mantener?      |
| ----------------- | --------------------------------- | ------------------------- |
| `ArrowLeft/Right` | Mover una columna si no colisiona | Sí                        |
| `ArrowDown`       | Bajar una fila (+1) o fijar       | Sí                        |
| `ArrowUp`, `KeyX` | Rotar                             | No (se ignora `e.repeat`) |
| `Space`           | Caída directa                     | No (se ignora `e.repeat`) |
| `KeyP`            | Llama a `onTogglePause`           | No (se ignora `e.repeat`) |

### Convenciones

- Render sobre el canvas de 800×600: fondo `#0f0f17`; tablero en `BOARD_X` con fondo `#1a1a25`, borde `#2a2a3a` y cuadrícula `#22222e` de 0,5 px; bloques planos con brillo superior de 4 px a `rgba(255,255,255,0.12)`; panel "SIGUIENTE" (caja 120×120 del mismo estilo, rótulo dibujado en el canvas y la pieza centrada en 4×4 como en el original). Colores y proporciones fieles al original, sin recolorear con la paleta neón.
- El canvas solo pinta el mundo. El HUD (puntaje, nivel, líneas) y el overlay de fin del original **no** se dibujan en el canvas.
- El motor ignora el botón "reiniciar" del original: la partida nueva la inicia `GamePlayer` cambiando `runId`.
- `onGameOver` se emite una sola vez, `GAME_OVER_DELAY` segundos después de la colisión de aparición; durante ese lapso el tablero queda congelado a la vista y el motor ignora el teclado.
- Con `paused` activo el motor congela simulación y dibujo, ignora todas las teclas **excepto** `KeyP`, y al reanudar reinicia `lastTime`. `dt` se limita a `MAX_DT`.
- `preventDefault` sobre `ArrowLeft`, `ArrowRight`, `ArrowUp`, `ArrowDown` y `Space` (en `keydown` y `keyup`) solo mientras el motor esté montado y el foco no esté en un `input` o `textarea`. `KeyP` y `KeyX` tampoco se procesan con el foco en un `input` o `textarea`, para que el campo de iniciales del modal acepte esas letras.
- `GamePlayer` implementa `onTogglePause` como `() => { if (!over) setPaused((p) => !p) }`, de modo que `P` no hace nada con el modal abierto.
- Textos de UI en español.

---

## Plan de implementación

Cada paso deja el sistema funcional y es commiteable por sí solo. Antes de escribir código de Next, leer en `node_modules/next/dist/docs/` la guía de componentes cliente y la interacción con `cacheComponents` (según `AGENTS.md`; el reproductor ya renderiza `GamePlayer` dentro de `Suspense`). Usar `/frontend-design` para el trabajo de UI (según `CLAUDE.md`): aquí aplica al HUD con `extras`, al panel "SIGUIENTE" y al estilo del tablero, reutilizando las clases existentes.

1. Generalizar el contrato: en `components/games/types.ts` añadir `GameStat`, cambiar `GameStats` (`lives: number | null`, `extras?`, sin `tripleLeft`) y mover `EngineCallbacks` aquí; en `lib/games/asteroids/engine.ts` importar `EngineCallbacks` de `types.ts` y emitir `extras: [{ label: 'Triple', value: 'Ns' }]` solo mientras el disparo triple esté activo; en `components/game-player.tsx` reemplazar el estado `tripleLeft` por `extras` y pintarlos con `.hud-stat`. Verificar: `npx tsc --noEmit`, `npm run lint`, `/juegos/rocas/jugar` sin cambios visibles (el indicador `Triple Ns` sigue apareciendo al recoger el power-up).
2. Ocultar "Vidas" con `lives === null` y añadir el callback de pausa: `initialLives` en `GameEntry` (`rocas: 3`) y en `GamePlayer` (estado inicial y `restart`); `onTogglePause?` en `GameProps` y su implementación en `GamePlayer` (ignora si `over`), pasada al `entry.Component`. Verificar: `npx tsc --noEmit`, `npm run lint`, `/juegos/rocas/jugar` sigue mostrando `♥ ♥ ♥` y `/juegos/serpentina/jugar` (simulación) sigue mostrando 3 vidas.
3. Crear `lib/games/caida/pieces.ts`: las constantes de la tabla y funciones puras `createBoard()`, `rotateCW(shape)` y `collide(board, shape, ox, oy)`. Verificar: `npx tsc --noEmit` y `npm run lint`.
4. Crear `lib/games/caida/engine.ts` con la lógica: clase `CaidaEngine` con el estado como campos de instancia (`board`, `current`, `next`, `score`, `lines`, `level`, `dropInterval`, `dropAccum`), y métodos privados `spawn`, `lockPiece`, `clearLines`, `move`, `rotate`, `softDrop`, `hardDrop`, `ghostY`, `emitStats` (solo ante cambios) y el temporizador de `onGameOver`. Verificar: `npx tsc --noEmit` y `npm run lint`.
5. En `engine.ts`, añadir el ciclo de vida y el dibujo: `start()` (emite stats iniciales, inicia rAF), bucle con `MAX_DT` y gravedad, `draw()` (fondo, cuadrícula, tablero, fantasma, pieza actual, panel "SIGUIENTE"), `setPaused()` con reinicio de `lastTime` y `destroy()` (cancela rAF y temporizador). Verificar: `npx tsc --noEmit`.
6. En `engine.ts`, añadir los listeners de teclado según la tabla "Teclado": `keydown` y `keyup`, `preventDefault` condicionado al foco, filtro de `e.repeat`, `KeyP` activo incluso en pausa, y limpieza en `destroy()`. Verificar: `npx tsc --noEmit` y `npm run lint`.
7. Crear `components/games/caida-game.tsx` (`"use client"`): `<canvas className="game-canvas" width={800} height={600}>`, un efecto por `runId` que crea `new CaidaEngine(...)`, llama a `start()` y limpia con `destroy()`, un efecto para `paused`, y refs de callbacks incluyendo `onTogglePause`. Verificar: `npx tsc --noEmit`.
8. Registrar `caida` en `components/games/registry.ts` (`Component: CaidaGame`, `controls` de la sección Alcance, `initialLives: null`). Verificar: `/juegos/caida/jugar` monta el canvas con el tablero vacío y la pieza activa, el HUD muestra Puntuación, Nivel y Líneas sin "Vidas", y la barra inferior muestra los controles.
9. Verificación manual en `npm run dev` (puede hacerse con el MCP de Playwright): jugar `caida` hasta el fin (pulsar Espacio repetidamente sin mover apila la columna central y termina la partida), comprobar el modal, guardar el puntaje, comprobar con `execute_sql` la fila en `scores` y que aparece en `/juegos/caida` y `/salon`; probar `P`, PAUSA, FIN y "JUGAR DE NUEVO"; confirmar con `execute_sql` que `select count(*) from public.games where id = 'caida'` devuelve 1 y con `get_advisors` (security) que no hay hallazgos nuevos. Luego `npm run build`.

---

## Criterios de aceptación

- [x] `npm run build`, `npm run lint` y `npx tsc --noEmit` terminan sin errores.
- [x] `components/games/types.ts` ya no contiene `tripleLeft`, y `GameStats.lives` admite `null`.
- [x] `/juegos/caida/jugar` muestra el canvas 800×600 dentro del `.crt` con relación 4:3, el tablero de 10×20 vacío centrado (300×600 en coordenadas lógicas), una pieza activa en la fila 0 centrada, y el panel "SIGUIENTE" a la derecha con otra pieza.
- [x] El HUD de `caida` muestra Puntuación, Nivel y Líneas, y **no** muestra "Vidas"; el HTML renderizado en el servidor tampoco la incluye.
- [x] En `rocas` el HUD sigue mostrando `♥ ♥ ♥` y `Triple Ns` al recoger el power-up; en `/juegos/serpentina/jugar` (simulación) siguen las 3 vidas.
- [x] ← → mueven la pieza una columna sin atravesar las paredes ni piezas fijas; ↑ y X rotan con las patadas `[0,-1,1,-2,2]`; la página no hace scroll con las flechas ni con Espacio mientras se juega.
- [x] Mantener ← → ↓ repite el movimiento; mantener ↑, X o Espacio ejecuta una sola acción por pulsación.
- [x] A nivel 1 la pieza baja una fila cada ~1 s; ↓ baja una fila y suma +1; Espacio coloca la pieza en la posición de la sombra y suma exactamente 2 por fila recorrida.
- [x] Limpiar 1, 2, 3 y 4 líneas suma 100, 300, 500 y 800 multiplicado por el nivel vigente, y el valor aparece en el HUD de React.
- [x] Al llegar a 10 líneas el nivel pasa a 2 y la caída pasa a 910 ms por fila; el stat Líneas coincide con las líneas limpiadas.
- [x] La sombra de aterrizaje se dibuja bajo la pieza activa con opacidad 0,2 y se actualiza al moverla o rotarla.
- [x] Cuando la pieza nueva no cabe, el tablero se congela y ~1,2 s después se abre el modal "FIN DEL JUEGO" con la puntuación final correcta; no aparece ningún overlay "GAME OVER" dentro del canvas y el modal se abre una sola vez.
- [x] `P` pausa y reanuda (overlay "EN PAUSA"); el botón PAUSA hace lo mismo; con el modal abierto `P` no pausa nada.
- [x] El campo de iniciales del modal acepta espacios y las letras `P` y `X` sin que el juego reaccione ni la página haga scroll.
- [x] "GUARDAR PUNTUACIÓN" crea una fila en `scores` con `game_id = 'caida'`, el nombre escrito, la puntuación del HUD y `user_id` nulo, y muestra `▸ PUNTUACIÓN GUARDADA_`.
- [x] Tras guardar, `/juegos/caida` y `/salon` muestran el puntaje al navegar a ellas sin reiniciar el servidor, y `Puntuaciones` aumenta en 1.
- [x] "JUGAR DE NUEVO" arranca una partida limpia (puntaje 0, nivel 1, líneas 0, tablero vacío); PAUSA congela y REANUDAR continúa sin salto de la pieza; FIN abre el modal con el puntaje actual; SALIR navega sin errores en consola.
- [x] Al salir de la ruta no quedan listeners de teclado, ni `requestAnimationFrame`, ni el temporizador de fin activos (las flechas, Espacio, `P` y `X` recuperan su comportamiento normal en otras pantallas).
- [x] `/biblioteca` y `/` muestran `caida` en su posición (`sort_order` 2) con su `long` actual, y `select count(*) from public.games where id = 'caida'` devuelve 1; no se creó ninguna migración.
- [x] No hay errores en consola ni advertencias de hidratación en `/juegos/caida/jugar` ni en `/juegos/rocas/jugar`.
- [x] `../03-tetris` queda sin cambios (`git status` en esa carpeta no muestra modificaciones).

---

## Decisiones tomadas y descartadas

- **Sí:** reutilizar la entrada `caida` del catálogo. Ya es el Tetris del catálogo (PUZZLE, `cover-tetro`, `long` acorde) y conserva ruta, portada y ranking; evita una entrada duplicada y una migración.
- **No:** crear una entrada nueva `tetris`. Habría dos juegos casi idénticos en la biblioteca.
- **Sí:** motor como clase TS con `destroy()`, sin globals. React 19 en modo estricto monta, desmonta y vuelve a montar efectos; los globals del original romperían el reinicio.
- **Sí:** registro `id → componente`; `GamePlayer` sigue siendo el contenedor común (pausa, modal, guardado).
- **Sí:** generalizar `GameStats` en esta spec (`lives: number | null`, `extras`). `tripleLeft` era exclusivo de Asteroids y el HUD no puede crecer con un campo por juego.
- **No:** añadir `lines` como campo fijo de `GameStats`. Solo Tetris lo usa; `extras` evita repetir el problema con el siguiente juego.
- **Sí:** `onTogglePause` opcional en el contrato para que `P` funcione como en el original. La pausa sigue perteneciendo a `GamePlayer`; el motor solo la solicita.
- **No:** que el motor se pause por su cuenta con `P`. Habría dos fuentes de verdad para `paused` y el botón PAUSA se desincronizaría.
- **Sí:** `initialLives` en `GameEntry`. `GamePlayer` renderiza primero con el estado inicial, así que sin él "Vidas" aparecería en el HTML del servidor y desaparecería tras el primer `onStats`. Es una decisión técnica derivada de `lives: null`, no del original.
- **Sí:** canvas fiel al original (siete colores por pieza, fondo y cuadrícula del original, fantasma al 20 %). Misma decisión que en SPEC 05 con Asteroids.
- **No:** recolorear con la paleta neón. Se aparta del original; si se quiere, es un cambio de diseño posterior.
- **Sí:** tablero centrado y panel "SIGUIENTE" dibujado en el canvas. La pieza siguiente es parte del mundo del juego y no cabe como texto en el HUD.
- **Sí:** puntos y velocidad del original sin cambios (`LINE_SCORES × nivel`, +1 por fila al bajar con ↓, +2 por fila en caída directa, `dropInterval` mínimo de 100 ms).
- **Sí:** piezas aleatorias puras y patadas horizontales simples, como el original. Bolsa de 7 o SRS cambian la jugabilidad y van en otra spec.
- **Sí:** ignorar `e.repeat` en Espacio, rotar y `P`; permitirlo en ← → ↓. Mantener Espacio apretado encadenaría caídas directas y arruinaría varias piezas; el original no lo filtraba. Es una desviación consciente del original.
- **Sí:** `onGameOver` tras ~1,2 s, como Asteroids. Deja ver el tablero lleno antes del modal; el original abría el overlay al instante.
- **Sí:** pausa solo con `P` y el botón PAUSA. `Escape` (mencionado en `requirenments.md`) queda fuera.
- **Sí:** el fin de partida lo gestiona la plataforma (modal existente); no hay reinicio propio en el canvas.
- **Sí:** el puntaje se guarda con la Server Action `saveScore` existente. **No:** tabla o columna propia por juego.
- **Sí:** `onStats` solo ante cambios, no por frame, para no re-renderizar `GamePlayer` 60 veces por segundo.
- **Sí:** `requirenments.md` (menú de pausa, nivel inicial, records locales, skins) completo fuera de alcance. La plataforma ya cubre pausa, reinicio y ranking.
- **Sí:** `Math.random` solo dentro del motor, que se crea en un efecto. Nunca durante el render.
- **Sí:** `pieces.ts` separado de `engine.ts` para que las constantes y funciones puras se lean y revisen aparte del bucle y el dibujo.

---

## Riesgos identificados

| Riesgo                                                                                    | Mitigación                                                                                                                              |
| ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Listeners, `requestAnimationFrame` o el temporizador de fin quedan activos tras desmontar | `destroy()` los limpia; criterio de aceptación específico.                                                                              |
| Espacio activa el botón PAUSA enfocado o hace scroll                                      | `preventDefault` en `keydown` y `keyup` de las teclas de control mientras se juega; verificar en el paso 9.                             |
| Capturar teclas rompe el campo de iniciales (ahora también con `P` y `X`)                 | No procesar ni hacer `preventDefault` con foco en `input`/`textarea`; `onTogglePause` ignora `over`; criterio de aceptación específico. |
| `P` pausa por el motor y el botón PAUSA queda desincronizado                              | El motor solo llama a `onTogglePause`; `GamePlayer` es el único dueño de `paused`.                                                      |
| Desajuste de hidratación                                                                  | Canvas y motor se crean solo en efectos; `Math.random` solo dentro del motor; `initialLives` evita que "Vidas" cambie tras hidratar.    |
| El stat "Líneas" aparece tras el primer `onStats` y mueve el HUD un instante              | El motor emite `onStats` en `start()`; aceptado como mejora visual menor, a revisar con `/frontend-design`.                             |
| Salto de `dt` tras pausar o cambiar de pestaña (el original no limitaba `dt`)             | `MAX_DT` de 0,05 s y `lastTime` reiniciado al reanudar; el acumulador de gravedad no puede soltar varias caídas de golpe.               |
| Generalizar `GameStats` rompe `rocas`                                                     | El paso 1 es verificable por sí solo: `rocas` debe seguir mostrando `Triple Ns` y las vidas antes de empezar el motor nuevo.            |
| El `controls` es más largo que el de Asteroids y se corta en la barra inferior del `.crt` | Revisar en el paso 8 a 1280 px y bajo 768 px; si se corta, abreviarlo en la barra con `/frontend-design` sin cambiar las teclas.        |
| Un puntaje mayor a 1.000.000 es rechazado por `saveScore` (límite de SPEC 06)             | Aceptado: es inalcanzable en una partida normal; si ocurre el modal muestra el error genérico y permite reintentar.                     |
| El original contradice su propio `requirenments.md`                                       | Fuente de verdad: `game.js` (puntos, nivel y velocidad); el `requirenments.md` son ideas futuras, no comportamiento actual.             |

---

## Lo que **no** está en esta spec

- Menú de pausa propio, selector de nivel inicial, records locales ni skins.
- Bolsa de 7 piezas, rotación SRS, "hold", combos o cualquier cambio de reglas respecto a `game.js`.
- Pausa con `Escape`.
- Controles táctiles, soporte móvil, sonido y `devicePixelRatio`.
- Anti-trampa, rate limit o puntajes firmados por el motor.
- Tests automatizados.
- Migrar los otros 6 juegos simulados (Bloque Buster, Serpentina, Glotón, Invasores, Ranaria, Duelo Píxel).
- Cambios de esquema o de código del leaderboard.
- Modificar o borrar `../03-tetris`.

Cada uno, si se aborda, va en su propia spec.
