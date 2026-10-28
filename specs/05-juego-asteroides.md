# SPEC 05 — Primer juego real: Asteroids portado a Next.js

> **Status:** aprobado
> **Depends on:** SPEC 01
> **Date:** 2026-10-27
> **Objective:** Portar el juego Asteroids de `../02-asteroids` (canvas + JS puro) a un componente de Next.js que `GamePlayer` carga mediante un registro de juegos para la entrada `rocas`, reportando puntaje, vidas, nivel y fin de partida al HUD y al modal de la plataforma.

---

## Por qué existe esta spec

Hasta ahora `/juegos/[id]/jugar` simula una partida con un `setInterval` que suma puntos al azar y muestra una arena decorativa en CSS. Asteroids es el primer juego real que llega a la plataforma. Esta spec porta su motor y, sobre todo, fija el **contrato** entre `GamePlayer` y un juego (registro + props), de modo que Tetris y Arkanoid se integren después sin rehacer el contenedor.

El código fuente del juego vive fuera del repo, en `../02-asteroids/game.js` (498 líneas, `'use strict'`, estado en globals del módulo, HUD y "GAME OVER" dibujados en el canvas, reinicio con Espacio). Se porta a TypeScript; la carpeta original no se modifica.

---

## Alcance

**Dentro:**

- Motor de juego en TypeScript, sin globals ni acceso al DOM salvo el canvas recibido: `lib/games/asteroids/engine.ts`. Porta tal cual la jugabilidad existente: nave con rotación, empuje y fricción; disparo con enfriamiento; asteroides de tamaño 3→2→1 que se parten; mundo toroidal; partículas; 3 vidas con invencibilidad de 3 s al reaparecer; power-up de disparo triple (12 % por asteroide destruido, una vez por nivel, 10 s); niveles con `3 + level` asteroides; puntos 20/50/100 según tamaño 3/2/1.
- Contrato común de juego en `components/games/types.ts`: `GameProps` y `GameStats`.
- Componente cliente `components/games/asteroids-game.tsx`: crea el motor sobre un `<canvas width=800 height=600>`, escala el canvas al `.crt-screen` (relación 4:3), registra y limpia los listeners de teclado y el `requestAnimationFrame`.
- Registro `components/games/registry.ts`: mapa `id de juego → { Component, controls }`. Solo `rocas` está registrado.
- Cambios en `components/game-player.tsx`: si el juego está en el registro, monta el componente real en lugar de la arena falsa y de la simulación de puntos; el HUD de React (puntaje, vidas, nivel) pasa a leer los valores reales; los botones PAUSA, FIN y SALIR y el modal "FIN DEL JUEGO" funcionan igual que hoy. Los otros 7 juegos conservan la simulación sin cambios.
- Indicador de disparo triple en el HUD de React (valor y segundos restantes) visible solo mientras esté activo.
- Texto de controles en la barra inferior del `.crt` (`← → ROTAR · ↑ PROPULSAR · ESPACIO DISPARAR`).
- Ajustar `long` de `rocas` en `lib/games.ts`: quitar la mención a los OVNIs (el juego no los tiene) y mencionar el disparo triple. `id`, `title`, `short`, `cat`, `cover`, `color`, `best` y `plays` no cambian.
- Regla mínima en `app/globals.css` para que el canvas ocupe el 100 % del `.crt-screen` (`.game-canvas`).

**Fuera de alcance (specs futuras):**

- Tetris (`../03-tetris`) y Arkanoid (`../04-arkanoid`), ni mover los otros 7 juegos fuera de la simulación.
- Tipos de enemigo que el README original menciona pero el código no tiene (estrella fugaz, OVNIs).
- Controles táctiles y soporte móvil: bajo 768 px el canvas se escala pero el juego solo se controla con teclado.
- Sonido y música.
- Persistir puntajes en Supabase, tabla de juegos o ranking real: el puntaje se sigue guardando con `saveScore` (`localStorage`, `av_scores`).
- Actualizar `best`/`plays` del catálogo a partir de partidas reales.
- Tests automatizados (no hay runner configurado) y manejo de `devicePixelRatio` (el canvas mantiene resolución lógica 800×600).
- Cualquier cambio visual fuera del reproductor de `rocas`.
- Modificar o borrar `../02-asteroids`.

---

## Modelo de datos

No se introducen datos persistentes. Tipos y contrato:

```ts
// components/games/types.ts
export type GameStats = {
  score: number;
  lives: number;
  level: number;
  /** Segundos restantes de disparo triple; 0 si no está activo. */
  tripleLeft: number;
};

export type GameProps = {
  /** Congela la simulación y el dibujo (se conserva el último frame). */
  paused: boolean;
  /** Cambiar este valor reinicia la partida desde cero (nueva instancia del motor). */
  runId: number;
  /** Se invoca solo cuando algún campo de GameStats cambia, no en cada frame. */
  onStats: (stats: GameStats) => void;
  /** Se invoca una sola vez por partida, al agotarse las vidas. */
  onGameOver: (score: number) => void;
};
```

```ts
// components/games/registry.ts
import type { ComponentType } from 'react';
import type { GameProps } from './types';

export type GameEntry = {
  Component: ComponentType<GameProps>;
  controls: string;
};
export const GAME_REGISTRY: Record<string, GameEntry>; // { rocas: {...} }
```

```ts
// lib/games/asteroids/engine.ts
export type EngineCallbacks = {
  onStats: (stats: GameStats) => void;
  onGameOver: (score: number) => void;
};

export class AsteroidsEngine {
  constructor(canvas: HTMLCanvasElement, callbacks: EngineCallbacks);
  start(): void; // inicia rAF y listeners de teclado
  setPaused(paused: boolean): void;
  destroy(): void; // cancela rAF y quita todos los listeners
}
```

Convenciones:

- Las constantes del juego (`W = 800`, `H = 600`, `RADII`, `SPEEDS`, `POINTS`, `POWERUP_CHANCE`, `TRIPLE_DURATION`, `SPREAD`) se conservan con los mismos valores y nombres.
- El canvas solo pinta el mundo (fondo negro, nave, balas, asteroides, partículas, power-up). El HUD (`SCORE`, `NIVEL`, íconos de vida, `TRIPLE`) y el overlay `GAME OVER` del original **no** se dibujan en el canvas.
- El motor ignora Espacio para reiniciar: la partida nueva la inicia `GamePlayer` cambiando `runId`.
- `preventDefault` sobre `ArrowLeft`, `ArrowRight`, `ArrowUp`, `ArrowDown` y `Space` solo mientras el motor esté montado y el foco no esté en un `input` o `textarea`, para no romper el campo de iniciales del modal.
- Textos de UI en español, igual que el resto de la plataforma.

---

## Plan de implementación

Antes de escribir código de Next, leer la guía relevante en `node_modules/next/dist/docs/` (según `AGENTS.md`; en especial componentes cliente y la interacción con `cacheComponents`; el reproductor ya renderiza `GamePlayer` dentro de `Suspense`). Usar `/frontend-design` para el trabajo de UI (según `CLAUDE.md`): aquí aplica al HUD, al indicador de triple y a la barra de controles, reutilizando las clases existentes.

1. Crear `components/games/types.ts` (`GameStats`, `GameProps`) y `lib/games/asteroids/engine.ts` con el motor portado de `../02-asteroids/game.js`: clases `Bullet`, `Asteroid`, `Ship`, `Particle`, `PowerUp` y `AsteroidsEngine` con el estado como campos de instancia; las clases reciben el `ctx` en `draw(ctx)`; HUD, overlay y reinicio por Espacio eliminados; emisión de `onStats` solo ante cambios; `onGameOver` emitido una vez, unos 1,2 s después de perder la última vida para que se vea la explosión. Verificar con `npx tsc --noEmit` y `npm run lint`.
2. Crear `components/games/asteroids-game.tsx` (`"use client"`): `<canvas className="game-canvas" width={800} height={600}>`, un efecto que crea `new AsteroidsEngine(...)` y llama a `start()`, con limpieza `destroy()`, dependiente de `runId`; un efecto que propaga `paused` con `setPaused`. Verificar: `npx tsc --noEmit`.
3. Crear `components/games/registry.ts` con la entrada `rocas` y su texto de controles. Verificar: `npx tsc --noEmit`.
4. Modificar `components/game-player.tsx`: leer `GAME_REGISTRY[game.id]`; si existe, montar `<Component paused={paused || over} runId={runId} onStats onGameOver />` dentro de `.crt-screen` en vez de `.game-arena`, no iniciar el `setInterval` de simulación, alimentar `score`, `lives` y `level` desde `onStats`, abrir el modal en `onGameOver` y reiniciar con un nuevo `runId` (sin `scoreRef`). Mostrar la vida como `♥` repetidos según `lives`, el indicador `TRIPLE Ns` si `tripleLeft > 0` y los `controls` en la barra inferior. Los juegos sin entrada en el registro se comportan igual que antes. Agregar `.game-canvas { display: block; width: 100%; height: 100%; }` a `app/globals.css`. Verificar: `npx tsc --noEmit`, `npm run lint` y `/juegos/caida/jugar` sigue mostrando la simulación.
5. Actualizar el `long` de `rocas` en `lib/games.ts`. Verificar: `/juegos/rocas` muestra la nueva descripción sin OVNIs.
6. Verificación manual en `npm run dev` de `/juegos/rocas/jugar` (puede hacerse con el MCP de Playwright): jugar hasta perder las 3 vidas, comprobar el modal, guardar el puntaje, jugar de nuevo, pausar y reanudar, y salir. Luego `npm run build`.

---

## Criterios de aceptación

- [ ] `npm run build`, `npm run lint` y `npx tsc --noEmit` terminan sin errores.
- [ ] `/juegos/rocas/jugar` muestra un canvas con la nave en el centro, 4 asteroides grandes fuera de un radio de 130 px del centro, y vectores blancos sobre fondo negro, dentro del marco `.crt` con relación 4:3.
- [ ] La nave rota con ← →, empuja con ↑ y dispara con Espacio (cooldown de 0,2 s); la página no hace scroll con las flechas ni con Espacio mientras se juega.
- [ ] Destruir un asteroide de tamaño 3, 2 o 1 suma respectivamente 20, 50 o 100 puntos, y el valor aparece en el HUD de React; los grandes se parten en dos medianos y los medianos en dos pequeños.
- [ ] El HUD muestra tantos `♥` como vidas restantes: baja de 3 a 2 a 1 tras cada choque, y la nave reaparece tras 2 s con 3 s de invencibilidad parpadeante.
- [ ] Al destruir todos los asteroides el nivel sube en el HUD y aparecen `3 + nivel` asteroides nuevos.
- [ ] Al recoger el power-up (círculo cian con "3") aparece `TRIPLE Ns` en el HUD, la nave dispara tres balas en abanico de ±0,26 rad y el indicador desaparece al llegar a 0.
- [ ] Al perder la última vida se abre el modal "FIN DEL JUEGO" con la puntuación final correcta, tras ~1,2 s; no aparece el overlay "GAME OVER" dentro del canvas.
- [ ] En el modal, el campo de iniciales acepta espacios y letras sin que la nave dispare ni la página haga scroll; "GUARDAR PUNTUACIÓN" escribe la entrada en `av_scores` con `game: "rocas"` y la puntuación del HUD.
- [ ] "JUGAR DE NUEVO" arranca una partida nueva con puntaje 0, 3 vidas y nivel 1; "VOLVER AL VAULT" y "SALIR" navegan sin errores en consola.
- [ ] PAUSA congela la nave, los asteroides y las partículas, muestra el overlay "EN PAUSA" y REANUDAR continúa sin salto brusco; FIN abre el modal con el puntaje actual y detiene la simulación.
- [ ] Al salir de la ruta no quedan listeners de teclado ni un `requestAnimationFrame` activos (las flechas y Espacio recuperan su comportamiento normal en otras pantallas).
- [ ] `/juegos/caida/jugar` (y los demás juegos sin entrada en el registro) siguen mostrando la arena y la simulación actuales.
- [ ] El `long` de `rocas` ya no menciona OVNIs; `/biblioteca`, `/` y `/salon` se ven igual que antes.
- [ ] No hay errores en consola ni advertencias de hidratación en `/juegos/rocas/jugar`.

---

## Decisiones tomadas y descartadas

- **Sí:** reutilizar la entrada `rocas` del catálogo. Evita dos juegos casi idénticos en la biblioteca y conserva ruta, portada y mock de ranking.
- **No:** crear una entrada nueva `asteroids`. Habría duplicado el juego en la biblioteca.
- **Sí:** registro `id → componente` y `GamePlayer` como contenedor común. Pausa, guardado de puntaje y modal ya existen y los necesitan todos los juegos; Tetris y Arkanoid solo añaden su motor.
- **No:** página propia solo para `rocas`. Es más rápido pero duplica el modal y obliga a repetirlo en cada juego.
- **No:** iframe con `index.html` en `public/`. No hay puntaje hacia la plataforma sin `postMessage` y no se integra al diseño.
- **Sí:** el motor es una clase TypeScript sin globals, con `destroy()`. React 19 y el modo estricto montan, desmontan y vuelven a montar efectos; los globals del original romperían el reinicio.
- **Sí:** HUD de React con canvas vectorial blanco fiel al original. Mantiene consistencia visual con la plataforma y reutiliza `.hud-stat`; el canvas conserva la estética vectorial clásica.
- **No:** recolorear el canvas con la paleta neón. Se aparta del juego original; si se quiere, es un cambio de diseño posterior.
- **Sí:** el fin de partida lo gestiona la plataforma (modal existente). El "ESPACIO PARA REINICIAR" del canvas se elimina para no tener dos flujos de reinicio.
- **Sí:** `onStats` solo ante cambios, no por frame. Evita re-renderizar `GamePlayer` 60 veces por segundo.
- **Sí:** retraso de ~1,2 s antes de `onGameOver`. Es una elección propia, no un requisito del usuario: deja ver la explosión de la nave antes del modal.
- **Sí:** sin soporte táctil ni `devicePixelRatio` en esta spec. Son dominios propios (controles móviles, nitidez) y el juego original no los tiene.
- **Sí:** los otros 7 juegos conservan la simulación. El registro permite migrarlos uno por uno.
- **No:** estrella fugaz ni OVNIs. El README original los menciona pero `game.js` no los implementa (así lo documenta el `CLAUDE.md` del juego); se abordan, si se quiere, en una spec propia.
- **Sí:** puntaje en `localStorage` mediante `saveScore`. Auth y tablas de puntajes de Supabase van en specs futuras (ver SPEC 04).
- **Sí:** texto de controles en la barra inferior del `.crt`, para que el jugador conozca las teclas sin salir de la pantalla.

---

## Riesgos identificados

| Riesgo                                                                                       | Mitigación                                                                                                                                         |
| -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Listeners de teclado o `requestAnimationFrame` quedan activos tras desmontar (modo estricto) | `destroy()` cancela rAF y quita listeners; criterio de aceptación específico; probar navegando a otras pantallas tras jugar.                       |
| Espacio activa el botón PAUSA enfocado en lugar de disparar (o scroll con Espacio)           | `preventDefault` en `keydown` y `keyup` de Espacio mientras se juega; si persiste, quitar el foco del botón tras pulsarlo. Verificar en el paso 6. |
| Capturar teclas rompe el campo de iniciales del modal                                        | No hacer `preventDefault` cuando el foco está en `input`/`textarea`; el motor se detiene (`paused                                                  |     | over`) mientras el modal está abierto. |
| Desajuste de hidratación                                                                     | El canvas y el motor se crean solo en efectos; ningún `Math.random` ni medida del DOM durante el render.                                           |
| Salto de `dt` tras pausar o cambiar de pestaña                                               | Se conserva el tope de `dt` de 0,05 s y se reinicia `lastTime` al reanudar.                                                                        |
| Re-renderizados excesivos de `GamePlayer`                                                    | `onStats` solo emite ante cambios; los cambios por frame (posiciones) no pasan por React.                                                          |
| Divergencia entre el juego original y el portado                                             | Se conservan constantes y fórmulas del original; se compara el comportamiento en el paso 6. El código en `../02-asteroids` no se modifica.         |
| El README del juego original (puntos, power-ups, estrella fugaz) contradice el código        | Fuente de verdad: `game.js` (puntos 20/50/100, power-up de triple, sin OVNIs ni estrella fugaz).                                                   |

---

## Lo que **no** está en esta spec

- Tetris, Arkanoid ni la migración del resto de juegos fuera de la simulación.
- Estrella fugaz, OVNIs u otros enemigos nuevos.
- Controles táctiles, soporte móvil, sonido y `devicePixelRatio`.
- Puntajes, usuarios o catálogo en Supabase, ni actualizar `best`/`plays` con datos reales.
- Tests automatizados.
- Cambios visuales fuera del reproductor de `rocas`.

Cada uno, si se aborda, va en su propia spec.
