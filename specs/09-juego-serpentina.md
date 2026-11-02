# SPEC 09 — Serpentina (Snake) como juego real con leaderboard

> **Status:** Implementado
> **Depends on:** SPEC 05, SPEC 06, SPEC 07, SPEC 08
> **Date:** 2026-11-02
> **Objective:** Crear el juego Snake como componente de Next.js que `GamePlayer` carga desde el registro para el id `serpentina`, usando las frutas de `demos/snake-assets/` como comida y reportando puntaje, nivel, longitud y fin de partida, con su puntaje en el leaderboard de Supabase.

---

## Por qué existe esta spec

Serpentina es el cuarto juego real de la plataforma. El catálogo ya tiene la entrada `serpentina` (ARCADE, `cover-snake`, verde, `sort_order` 3), hoy simulada con puntos al azar. Esta spec la reemplaza por un Snake escrito desde cero en TypeScript: no hay original en una carpeta hermana ni existe `lib/games/serpentina/`.

Los assets de partida están en `demos/snake-assets/`:

- `fruits.png` (3790×442, fondo transparente): tres filas de frutas en tres estilos (plano, pixel-art, realista).
- `sprites.js`: atlas `window.SPRITE_ATLAS` con los rectángulos `{ x, y, w, h }` de **22 frutas de la fila del medio** (pixel-art, `y = 136`, `h = 160`). Es un global de prototipo; aquí se porta a un módulo TypeScript. Sus coordenadas se detectaron por análisis de píxeles y se verifican visualmente en el paso 1.

No hay sprites de la serpiente: se dibuja con formas planas en la paleta neón de la plataforma. Es el segundo juego que depende de un asset de imagen cargado de forma asíncrona (SPEC 08 fijó ese patrón: el motor no arranca el bucle hasta que la imagen carga). El contrato de SPEC 07 ya está generalizado (`GameStats.lives: number | null`, `extras?`, `onTogglePause?`, `initialLives`); esta spec no lo toca.

---

## Alcance

**Dentro:**

- Asset: copia de `demos/snake-assets/fruits.png` a `public/games/serpentina/fruits.png`. El original de `demos/` no se mueve ni se borra; `sprites.js` no se copia ni se carga (se porta a TS).
- Motor, tres archivos en `lib/games/serpentina/`:
  - `sprites.ts`: `FRUITS` (22 rectángulos portados de `sprites.js`) y `loadFruitsSheet()`.
  - `board.ts`: constantes de la cuadrícula, tipos y funciones puras (`stepMs`, `levelFor`, `randomFreeCell`).
  - `engine.ts`: clase `SerpentinaEngine` con `constructor(canvas, callbacks)`, `start()`, `setPaused()`, `destroy()`. Sin globals; solo pinta el mundo; el HUD y el "GAME OVER" los dibuja la plataforma; el motor no reinicia solo (lo hace `GamePlayer` con `runId`).
- Componente: `components/games/serpentina-game.tsx` (`"use client"`), patrón de `asteroids-game.tsx` y `bloque-buster-game.tsx`.
- Registro: entrada `serpentina` en `components/games/registry.ts` con `controls: '← ↑ ↓ → WASD MOVER · P PAUSA'` e `initialLives: null`.
- Catálogo: sin `insert` (la fila existe) y `.cover-snake` ya existe en `app/globals.css`. Migración `supabase/migrations/<timestamp>_game_serpentina_long.sql` con un `update` del `long` (el actual habla de "núcleos magenta" y el juego usa frutas), aplicada con `apply_migration` con el mismo nombre y contenido. `id`, `title`, `short`, `cat`, `cover`, `color` y `sort_order` no cambian.
- `.game-canvas` ya existe en `app/globals.css`; no se redefine.

**Leaderboard:** sin cambios de esquema ni de código. `scores`, `game_stats`, `top_scores`, `saveScore`, `/juegos/[id]` y `/salon` operan sobre cualquier `id` de `games`; aquí solo se verifica que el puntaje de `serpentina` se guarda y aparece.

**Fuera de alcance (specs futuras):**

- Sonido (comer, morir): va en una spec transversal de la plataforma.
- Controles táctiles y móvil: bajo 768 px el canvas se escala pero se controla con teclado.
- Manejo de `devicePixelRatio` (resolución lógica fija 800×600).
- Anti-trampa: el puntaje lo envía el navegador y es falsificable (ver SPEC 06).
- Tests automatizados (no hay runner configurado).
- Fruta con valores distintos, frutas especiales, obstáculos, modo muros-atraviesan, vidas y varios mapas.
- Las filas plana y realista de `fruits.png` (no se usan; el PNG completo se copia igualmente para conservar el asset fiel).
- Récord local en `localStorage`: el ranking real es el de Supabase.
- Migrar los demás juegos simulados.
- Modificar o borrar `demos/snake-assets/`.

---

## Modelo de datos

No se introducen datos persistentes ni cambios de esquema. Solo un `update` del texto `long` (ver Alcance).

```ts
// lib/games/serpentina/engine.ts
export class SerpentinaEngine {
  constructor(canvas: HTMLCanvasElement, callbacks: EngineCallbacks);
  start(): void; // carga el PNG, emite onStats inicial, inicia rAF y listeners de teclado
  setPaused(paused: boolean): void;
  destroy(): void; // cancela rAF, el temporizador de fin, la carga pendiente y quita los listeners
}
```

```ts
// lib/games/serpentina/sprites.ts
export type Frame = { x: number; y: number; w: number; h: number };
export type FruitName =
  'banana' | 'orange' | /* ...22 nombres del atlas */ 'melon';
export const FRUITS: Record<FruitName, Frame>;
export const FRUIT_NAMES: FruitName[]; // Object.keys(FRUITS), orden del atlas
export function loadFruitsSheet(): Promise<CanvasImageSource>; // rechaza si el PNG no carga
```

```ts
// lib/games/serpentina/board.ts
export type Cell = { c: number; r: number };
export type Dir = 'up' | 'down' | 'left' | 'right';
export function stepMs(level: number): number;
export function levelFor(fruitsEaten: number): number;
export function randomFreeCell(occupied: Cell[]): Cell | null; // null si el tablero está lleno
```

### Constantes

| Constante          | Valor                                                                                                  |
| ------------------ | ------------------------------------------------------------------------------------------------------ |
| `W`, `H`           | `800`, `600` (4:3)                                                                                     |
| `CELL`             | `40` px                                                                                                |
| `COLS`, `ROWS`     | `20`, `15` (`W / CELL`, `H / CELL`; 300 celdas)                                                        |
| `START_LENGTH`     | `3`; la serpiente nace con la cabeza en `{ c: 10, r: 7 }`, mirando a la derecha, cuerpo a la izquierda |
| `BASE_STEP_MS`     | `150` (un paso de la serpiente cada 150 ms en el nivel 1)                                              |
| `STEP_DECREASE_MS` | `10` por nivel                                                                                         |
| `MIN_STEP_MS`      | `60` (se alcanza en el nivel 10)                                                                       |
| `FRUITS_PER_LEVEL` | `5`                                                                                                    |
| `POINTS_PER_FRUIT` | `10`                                                                                                   |
| `MAX_DT`           | `0.05` s                                                                                               |
| `MAX_QUEUED_TURNS` | `2`                                                                                                    |
| `GAME_OVER_DELAY`  | `1.2` s (igual que en las otras specs)                                                                 |

- `stepMs(level) = max(MIN_STEP_MS, BASE_STEP_MS - (level - 1) * STEP_DECREASE_MS)`.
- `levelFor(fruitsEaten) = 1 + floor(fruitsEaten / FRUITS_PER_LEVEL)`.

### Estados internos

`'playing' | 'dying' | 'won'`. No hay pantalla de título ni estado `ready` (la plataforma ya tiene portada y botón JUGAR) y la pausa es de `GamePlayer` (prop `paused`).

- `playing`: el motor acumula `dt` y avanza un paso cada `stepMs(level)`.
- `playing` → `dying` al chocar con un muro o con el propio cuerpo. La serpiente queda congelada y dibujada; a los `GAME_OVER_DELAY` s se emite `onGameOver(score)` una sola vez.
- `playing` → `won` al llenar las 300 celdas (`randomFreeCell` devuelve `null`). Mismo retardo y mismo `onGameOver(score)` que al perder (sin mensaje propio de victoria, como en SPEC 08).
- `dying` / `won`: el motor ignora el teclado y no actualiza stats.

### Reglas

- La serpiente avanza una celda por paso en su dirección actual. La primera fruta aparece al arrancar en una celda libre elegida al azar.
- Comer una fruta: +10 puntos, la serpiente crece 1 segmento (la cola no se retira en ese paso) y aparece otra fruta en una celda libre. La fruta nueva es un `FruitName` aleatorio de `FRUIT_NAMES`; todas valen lo mismo.
- Choque con muro: la cabeza sale de `0 ≤ c < COLS` o `0 ≤ r < ROWS`.
- Choque con el cuerpo: la cabeza entra en una celda ocupada por un segmento. Entrar en la celda que la cola va a dejar libre en ese mismo paso **no** es choque (salvo que en ese paso coma, porque entonces la cola no se mueve).
- Cola de giros: cada pulsación de dirección se encola (máximo `MAX_QUEUED_TURNS`); en cada paso se consume una. Se descarta una pulsación igual a la última dirección (encolada o actual) o la opuesta a ella, de modo que no hay giros de 180° ni pérdidas por dos pulsaciones rápidas dentro del mismo paso.
- Sin vidas: `lives: null`.
- `level` sube al comer la fruta 5, 10, 15…; la velocidad del nivel nuevo se aplica desde el siguiente paso.

### Evento → puntos

| Evento                         | Puntos / efecto                             |
| ------------------------------ | ------------------------------------------- |
| Comer una fruta                | +10, longitud +1                            |
| Subir de nivel (cada 5 frutas) | 0 puntos, el paso baja 10 ms (mínimo 60 ms) |
| Chocar                         | 0 puntos, fin de la partida                 |
| Llenar el tablero              | 0 puntos, fin de la partida                 |

Máximo teórico por partida: 297 frutas × 10 = 2.970, muy por debajo del límite de `saveScore`.

### Stats que reporta

- `score`: puntaje acumulado.
- `lives`: `null`.
- `level`: `1`+, ver `levelFor`.
- `extras`: `[{ label: 'Longitud', value: 'N' }]`, con `N` = número de segmentos (3 al empezar). Siempre presente.

`onStats` se emite una vez en `start()` y luego solo cuando cambia `score`, `level` o la longitud (es decir, al comer). Nunca por frame.

### Teclado

| Tecla                | Acción                  | ¿Repite al mantener?      |
| -------------------- | ----------------------- | ------------------------- |
| `ArrowUp`, `KeyW`    | Dirección arriba        | No (se ignora `e.repeat`) |
| `ArrowDown`, `KeyS`  | Dirección abajo         | No                        |
| `ArrowLeft`, `KeyA`  | Dirección izquierda     | No                        |
| `ArrowRight`, `KeyD` | Dirección derecha       | No                        |
| `KeyP`               | Llama a `onTogglePause` | No                        |

### Convenciones

- Render sobre el canvas de 800×600: tablero en damero de dos tonos muy oscuros que combinan con el fondo del `.crt`; serpiente de segmentos cuadrados con inset de 2 px en verde neón (color de la categoría `green`), cabeza más clara que el cuerpo; frutas con `drawImage` del recorte de `FRUITS`, escaladas para caber en la celda conservando la proporción (alto 36 px, centradas, máx. 40 px de ancho) y `ctx.imageSmoothingEnabled = false` para conservar el pixel-art. Los tonos y el brillo exactos se afinan con `/frontend-design`.
- Al morir (`dying`), la cabeza se pinta en un color de alerta (magenta o rojo de la paleta) para que se vea dónde chocó.
- El canvas pinta solo el mundo; el HUD (PUNTOS, Nivel, Longitud) y el overlay de fin no se dibujan en él.
- El movimiento es discreto: el dibujo se actualiza en cada fotograma pero la posición solo cambia en cada paso. No hay interpolación.
- El motor no arranca el bucle hasta que `loadFruitsSheet()` resuelve. Si `destroy()` se llama antes, la promesa resuelta se ignora. Si el PNG falla, se hace `console.error` y no se inicia el bucle (caso aceptado: el asset es local).
- Con `paused` activo el motor congela simulación y dibujo (se conserva el último fotograma), ignora todas las teclas **excepto** `KeyP`, y al reanudar reinicia `lastTime` y el acumulador de paso. `dt` se limita a `MAX_DT`.
- `preventDefault` sobre las cuatro flechas (en `keydown` y `keyup`) solo mientras el motor esté montado y el foco no esté en un `input` o `textarea`. `KeyW`, `KeyA`, `KeyS`, `KeyD` y `KeyP` tampoco se procesan con el foco en un `input` o `textarea`, para que el campo de iniciales del modal acepte esas letras.
- `Math.random` solo dentro del motor, que se crea en un efecto. Nunca durante el render.
- Textos de UI en español.

### Catálogo (migración)

```sql
update public.games
set "long" = 'Una serpiente de luz recorre la grilla buscando frutas. Cada bocado la alarga y suma puntos; cada cinco, sube el nivel y se vuelve más veloz. Un choque con el muro o con tu propio cuerpo y la partida termina.'
where id = 'serpentina';
```

---

## Plan de implementación

Cada paso deja el sistema funcional y es commiteable por sí solo. Antes de escribir código de Next, leer en `node_modules/next/dist/docs/` la guía de componentes cliente, la de archivos estáticos en `public/` y la interacción con `cacheComponents` (según `AGENTS.md`; el reproductor ya renderiza `GamePlayer` dentro de `Suspense`). Usar `/frontend-design` para el trabajo de UI (según `CLAUDE.md`): aquí aplica a la paleta del tablero, la serpiente y su cabeza, el color de la cabeza al morir, el tamaño de las frutas y la barra de controles.

1. Assets y sprites: copiar `demos/snake-assets/fruits.png` a `public/games/serpentina/fruits.png` y crear `lib/games/serpentina/sprites.ts` (`FRUITS` con los 22 rectángulos de `sprites.js`, `FRUIT_NAMES`, `loadFruitsSheet()` con ruta `/games/serpentina/fruits.png`). Verificar: `npx tsc --noEmit`, `npm run lint`, `/games/serpentina/fruits.png` responde 200 en `npm run dev`, y comprobar visualmente (script temporal o Playwright, sin commitear) que cada recorte de `FRUITS` encuadra una fruta completa sin cortar ni mezclar vecinas; si algún rectángulo falla, corregirlo en `sprites.ts`.
2. Tablero: crear `lib/games/serpentina/board.ts` con las constantes, `Cell`, `Dir`, `stepMs`, `levelFor` y `randomFreeCell`. Verificar: `npx tsc --noEmit`, `npm run lint`, y con un `console.log` temporal no commiteado: `stepMs(1) === 150`, `stepMs(10) === 60`, `stepMs(20) === 60`, `levelFor(4) === 1`, `levelFor(5) === 2`, `randomFreeCell` devuelve `null` con las 300 celdas ocupadas.
3. Motor, lógica: crear `lib/games/serpentina/engine.ts` con la clase y el estado (`status`, `snake`, `dir`, `turnQueue`, `fruit`, `fruitName`, `score`, `eaten`, `acc`) y los métodos privados `queueTurn`, `step`, `spawnFruit`, `eat`, `die` (arma el temporizador de `onGameOver`), `update(dt)` y `emitStats` (solo ante cambios). Verificar: `npx tsc --noEmit` y `npm run lint`.
4. Motor, ciclo de vida y dibujo: en `engine.ts` añadir `start()` (espera `loadFruitsSheet()`, emite stats iniciales, inicia rAF con `MAX_DT`), `draw()` (damero, fruta, serpiente, cabeza de alerta al morir), `setPaused()` con reinicio de `lastTime` y del acumulador, y `destroy()` (cancela rAF, temporizador y marca la carga pendiente como descartada). Verificar: `npx tsc --noEmit`.
5. Motor, teclado: en `engine.ts` añadir los listeners de `keydown`/`keyup` según la tabla "Teclado": mapa tecla → `Dir`, `preventDefault` condicionado al foco, filtro de `e.repeat`, `KeyP` activo incluso en pausa, y limpieza en `destroy()`. Verificar: `npx tsc --noEmit` y `npm run lint`.
6. Crear `components/games/serpentina-game.tsx` (`"use client"`): `<canvas className="game-canvas" width={800} height={600}>`, un efecto por `runId` que crea `new SerpentinaEngine(...)`, llama a `start()` y limpia con `destroy()`, un efecto para `paused`, y refs de callbacks incluyendo `onTogglePause`. Verificar: `npx tsc --noEmit`.
7. Registrar `serpentina` en `components/games/registry.ts` (`Component: SerpentinaGame`, `controls` de la sección Alcance, `initialLives: null`). Verificar: `/juegos/serpentina/jugar` monta el canvas con la serpiente de 3 segmentos y una fruta, el HUD muestra Puntuación 0, Nivel 1 y Longitud 3 **sin** "Vidas", y la barra inferior muestra los controles completos a 1280 px y bajo 768 px.
8. Catálogo: crear la migración `update` del `long` y aplicarla con `apply_migration` (mismo nombre y contenido). Verificar: `list_migrations`, `select id, "long" from public.games where id = 'serpentina'`, `get_advisors` (security) sin hallazgos nuevos y `/juegos/serpentina` muestra el texto nuevo (el catálogo está cacheado: en desarrollo se ve al recargar o reiniciar el servidor; `npm run build` lo regenera).
9. Verificación manual en `npm run dev` (puede hacerse con el MCP de Playwright): comer frutas y confirmar +10 y Longitud +1 en el HUD; chocar con un muro para llegar al fin, comprobar el modal, guardar el puntaje, comprobar con `execute_sql` la fila en `scores` y que aparece en `/juegos/serpentina` y `/salon`; probar `P`, PAUSA, FIN y "JUGAR DE NUEVO". Para ver el nivel 2 sin jugar a mano, ayudarse temporalmente del MCP de Playwright (`browser_evaluate`) sin modificar el código; no se commitea ningún atajo. Luego `npm run build`.

---

## Criterios de aceptación

- [x] `npm run build`, `npm run lint` y `npx tsc --noEmit` terminan sin errores.
- [x] `public/games/serpentina/fruits.png` existe, es idéntico a `demos/snake-assets/fruits.png` (mismo hash) y responde 200.
- [x] Cada uno de los 22 rectángulos de `FRUITS` dibuja una fruta completa, sin recortes ni fragmentos de otra fruta.
- [x] `/juegos/serpentina/jugar` muestra el canvas 800×600 dentro del `.crt` con relación 4:3, una serpiente de 3 segmentos con la cabeza en la columna 10, fila 7 mirando a la derecha, y una fruta pixel-art en una celda libre.
- [x] El HUD de `serpentina` muestra Puntuación, Nivel y un stat extra `Longitud` (3 al empezar) y **no** muestra Vidas.
- [x] Las flechas y `W A S D` giran la serpiente; la página no hace scroll con las flechas mientras se juega.
- [x] No se puede girar 180°: pulsar la dirección opuesta a la actual, o dos giros opuestos seguidos dentro de un mismo paso, no hace que la serpiente se muerda.
- [x] Comer una fruta suma exactamente 10 puntos, aumenta la Longitud en 1 y el valor aparece en el HUD de React; aparece una fruta nueva en una celda que no ocupa la serpiente.
- [x] El paso es de 150 ms en el nivel 1, el nivel sube a 2 al comer la fruta 5 (HUD) y el paso pasa a 140 ms; nunca baja de 60 ms.
- [x] Chocar con un muro o con el propio cuerpo congela la serpiente con la cabeza en color de alerta, y ~1,2 s después abre el modal "FIN DEL JUEGO" con la puntuación final correcta, una sola vez; no aparece ningún overlay "GAME OVER" dentro del canvas.
- [x] Entrar en la celda que la cola deja libre en ese mismo paso no cuenta como choque.
- [x] `P` pausa y reanuda (overlay "EN PAUSA"); el botón PAUSA hace lo mismo; con el modal abierto `P` no pausa nada; pausar y reanudar no produce salto de la serpiente.
- [x] El campo de iniciales del modal acepta espacios y las letras `P`, `W`, `A`, `S` y `D` sin que el juego reaccione ni la página haga scroll.
- [x] "GUARDAR PUNTUACIÓN" crea una fila en `scores` con `game_id = 'serpentina'`, el nombre escrito, la puntuación del HUD y `user_id` nulo, y muestra `▸ PUNTUACIÓN GUARDADA_`.
- [x] Tras guardar, `/juegos/serpentina` y `/salon` muestran el puntaje al navegar a ellas sin reiniciar el servidor, y `Puntuaciones` aumenta en 1.
- [x] "JUGAR DE NUEVO" arranca una partida limpia (puntaje 0, nivel 1, Longitud 3, una sola fruta); FIN abre el modal con el puntaje actual; SALIR navega sin errores en consola.
- [x] Al salir de la ruta, o al pulsar "JUGAR DE NUEVO" varias veces seguidas, no quedan listeners de teclado, ni `requestAnimationFrame`, ni el temporizador de fin activos, y no hay dos bucles simultáneos.
- [x] La migración `*_game_serpentina_long` aparece en `list_migrations`, `select count(*) from public.games where id = 'serpentina'` devuelve 1, y `/biblioteca`, `/` y `/juegos/serpentina` muestran el `long` nuevo, con `serpentina` en `sort_order` 3.
- [x] `rocas`, `caida`, `bloque-buster` y los juegos simulados (p. ej. `/juegos/gloton/jugar`) funcionan igual que antes.
- [x] No hay errores en consola ni advertencias de hidratación en `/juegos/serpentina/jugar`.
- [x] `demos/snake-assets/` queda sin cambios (`git status` no muestra modificaciones sobre esos archivos).

---

## Decisiones tomadas y descartadas

- **Sí:** reutilizar la entrada `serpentina` del catálogo. Ya es el Snake del catálogo (ARCADE, `cover-snake`, verde) y conserva ruta, portada y ranking; evita una entrada duplicada y un `insert`. **No:** slug nuevo `snake`.
- **Sí:** migración `update` del `long`. El texto actual dice "núcleos magenta" y las frutas lo contradicen. **No:** dejar el texto como está.
- **Sí:** reglas de Snake clásico: los muros y el cuerpo matan y no hay vidas (`lives: null`), así que el HUD no muestra Vidas. **No:** muros que atraviesan ni 3 vidas (se apartan del Snake clásico).
- **Sí:** +10 por fruta, nivel cada 5 frutas, paso de 150 ms que baja 10 ms por nivel hasta 60 ms. **No:** velocidad constante ni valores distintos por fruta.
- **Sí:** `extras: [{ label: 'Longitud', value: 'N' }]`, siempre presente. Es la medida natural de progreso en Snake y el HUD ya pinta `extras` de forma genérica.
- **Sí:** cuadrícula 20×15 de 40 px sobre un canvas de 800×600. Coincide con la resolución por defecto de la plataforma y el 4:3 del `.crt`, sin conversiones.
- **Sí:** frutas pixel-art de la fila del medio de `fruits.png`, la misma que mapea `sprites.js`; fruta aleatoria en cada aparición, todas con el mismo valor. **No:** una sola fruta fija, ni las filas plana y realista (no están mapeadas y el estilo pixel-art es coherente con el resto de la plataforma).
- **Sí:** serpiente y tablero con formas planas en la paleta neón de la plataforma. No hay sprites de serpiente en los assets. **No:** serpiente vectorial blanca (chocaría con las frutas de color).
- **Sí:** portar `sprites.js` a `lib/games/serpentina/sprites.ts` y copiar solo `fruits.png` a `public/`. El global `window.SPRITE_ATLAS` y su ruta `snake-assets/fruits.png` son de prototipo y no valen en Next.
- **Sí:** `ctx.imageSmoothingEnabled = false` en el motor para el pixel-art. **No:** `image-rendering: pixelated` inline en el canvas; el canvas es 800×600 con fondo propio y el escalado del `.crt` no es el problema aquí.
- **Sí:** el motor espera `loadFruitsSheet()` antes de iniciar el bucle y descarta la carga si ya se destruyó (patrón de SPEC 08).
- **Sí:** sin pantalla de título ni estado `ready`: la serpiente empieza a moverse al arrancar. La plataforma ya tiene portada y botón JUGAR, y Snake no tiene un "lanzamiento" como la pelota de Bloque Buster.
- **Sí:** cola de giros de hasta 2 pulsaciones, sin giros de 180°. Evita que dos pulsaciones rápidas dentro de un mismo paso hagan que la serpiente se muerda.
- **Sí:** entrar en la celda que deja libre la cola no es choque (salvo que coma en ese paso). Es la regla habitual de Snake y evita muertes injustas.
- **Sí:** llenar el tablero termina la partida con `onGameOver(score)`, igual que perder. **No:** `onWin` ni cambios al contrato.
- **Sí:** movimiento discreto sin interpolación. Es el aspecto clásico y evita especificar la interpolación en las curvas.
- **Sí:** `MAX_DT = 0.05` s, el valor de las otras specs. A 60 ms por paso mínimo, un `dt` de 0,05 s sigue produciendo como mucho un paso por fotograma.
- **Sí:** teclas de movimiento con filtro de `e.repeat`: cada pulsación es un giro, mantener la tecla no encola giros repetidos.
- **Sí:** `onStats` solo ante cambios, no por frame, para no re-renderizar `GamePlayer` 60 veces por segundo.
- **Sí:** sonido fuera de alcance, como en Asteroides, Caída y Bloque Buster.
- **Sí:** pausa solo con `P` y el botón PAUSA. **No:** `Escape` (consistente con SPEC 08).
- **Sí:** el puntaje se guarda con la Server Action `saveScore` existente. **No:** tabla o columna propia por juego.
- **Sí:** `Math.random` solo dentro del motor, que se crea en un efecto. Nunca durante el render.
- **Sí:** `sprites.ts` y `board.ts` separados de `engine.ts`, para revisar los recortes del PNG y las reglas puras aparte del bucle.

---

## Riesgos identificados

| Riesgo                                                                                             | Mitigación                                                                                                                                               |
| -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Los rectángulos de `sprites.js` (detectados por análisis de píxeles) recortan mal alguna fruta     | El paso 1 los verifica visualmente antes de escribir el motor; criterio de aceptación específico.                                                        |
| Listeners, `requestAnimationFrame` o el temporizador de fin quedan activos tras desmontar          | `destroy()` los limpia; criterio de aceptación específico.                                                                                               |
| `destroy()` antes de que el PNG cargue deja un bucle huérfano (modo estricto)                      | Bandera `destroyed`: al resolver la promesa se comprueba antes de iniciar rAF y listeners; criterio de "no hay dos bucles simultáneos".                  |
| El PNG (~570 KB) tarda en cargar y el canvas queda vacío un instante                               | Aceptado: es un asset local; el motor no arranca hasta tenerlo. Si se nota, valorar un indicador de carga en una spec propia.                            |
| Las flechas hacen scroll o `Espacio`/teclas activan el botón PAUSA enfocado                        | `preventDefault` en `keydown` y `keyup` de las flechas mientras se juega; verificar en el paso 9.                                                        |
| Capturar teclas rompe el campo de iniciales (`W`, `A`, `S`, `D`, `P`)                              | No procesar ni hacer `preventDefault` con foco en `input`/`textarea`; criterio de aceptación específico.                                                 |
| `P` pausa por el motor y el botón PAUSA queda desincronizado                                       | El motor solo llama a `onTogglePause`; `GamePlayer` es el único dueño de `paused`.                                                                       |
| Dos giros rápidos dentro de un paso hacen que la serpiente se muerda                               | Cola de giros con descarte de iguales y opuestos; criterio de aceptación específico.                                                                     |
| Salto de `dt` tras pausar o cambiar de pestaña                                                     | `MAX_DT = 0.05` s y `lastTime` y acumulador de paso reiniciados al reanudar.                                                                             |
| Desajuste de hidratación                                                                           | Canvas y motor se crean solo en efectos; `Math.random` solo dentro del motor; `initialLives: null` evita que "Vidas" aparezca y desaparezca al hidratar. |
| El catálogo está cacheado (`use cache`, tags `games` y `scores`) y el `update` del `long` no se ve | En desarrollo se ve al recargar o reiniciar; `npm run build` lo regenera. Documentado en el paso 8.                                                      |
| Frutas escaladas con `imageSmoothingEnabled = false` se ven irregulares por el escalado no entero  | Revisarlo con `/frontend-design` en el paso 7; si se ve mal, ajustar el alto de dibujo y registrarlo en Decisiones.                                      |
| El texto `controls` se corta en la barra inferior del `.crt`                                       | Revisar en el paso 7 a 1280 px y bajo 768 px; si se corta, abreviarlo con `/frontend-design` sin cambiar las teclas.                                     |

---

## Lo que **no** está en esta spec

- Sonido ni política de audio de la plataforma.
- Controles táctiles, soporte móvil y `devicePixelRatio`.
- Vidas, muros que atraviesan, obstáculos, frutas especiales o con valores distintos, y varios mapas.
- Récord local en `localStorage`, pantalla de título, menú de pausa propio y pantalla propia de victoria (`onWin`).
- Las filas plana y realista de `fruits.png`.
- Anti-trampa, rate limit o puntajes firmados por el motor.
- Tests automatizados.
- Cambios de esquema o de código del leaderboard.
- Migrar los otros 4 juegos simulados (Glotón, Invasores, Ranaria, Duelo Píxel).
- Modificar o borrar `demos/snake-assets/`.

Cada uno, si se aborda, va en su propia spec.
