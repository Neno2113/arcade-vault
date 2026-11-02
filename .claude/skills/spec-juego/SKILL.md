---
name: spec-juego
description: Diseña la spec de un juego nuevo para Arcade Vault (motor canvas en lib/games, componente en el registro, fila en la tabla games de Supabase y leaderboard). Solo escribe la spec; se implementa con /spec-impl.
disable-model-invocation: true
argument-hint: 'descripción corta del juego'
allowed-tools: Read, Glob, Grep, Write, AskUserQuestion, Bash(ls:*), Bash(cat:*), Bash(date:*)
---

# /spec-juego — Diseñador de specs de juegos

## Contexto de sesión

Fecha de hoy (úsala para la cabecera de la spec, nunca la adivines):
!`date +%F`

Specs existentes:
!`ls specs/ 2>/dev/null || echo "La carpeta specs/ no existe"`

Motores ya presentes en `lib/games/`:
!`ls lib/games/ 2>/dev/null || echo "lib/games/ no existe"`

Registro actual de juegos:
!`cat components/games/registry.ts 2>/dev/null`

Contrato actual `GameStats` / `GameProps`:
!`cat components/games/types.ts 2>/dev/null`

Migraciones de Supabase:
!`ls supabase/migrations/ 2>/dev/null`

---

Este skill produce **la spec** de un juego nuevo para Arcade Vault siguiendo el patrón de SPEC 05 (primer juego real) y SPEC 06 (catálogo y leaderboard en Supabase). **No escribes código aquí.** La implementación la hace después `/spec-impl`.

## Cómo entra un juego a la plataforma

Un juego completo toca estas piezas; la spec debe cubrirlas todas:

1. **Motor**: `lib/games/<slug>/engine.ts`, clase `<Nombre>Engine(canvas, { onStats, onGameOver })` con `start()`, `setPaused()` y `destroy()`. Sin globals, sin DOM salvo el canvas recibido.
2. **Componente**: `components/games/<slug>-game.tsx` (`'use client'`), copia el patrón de `asteroids-game.tsx` (refs de callbacks, efecto por `runId`, efecto de `paused`, `<canvas className="game-canvas">`).
3. **Registro**: entrada en `GAME_REGISTRY` de `components/games/registry.ts` con `Component` y `controls`. La clave es el `id` del juego en la tabla `games`.
4. **Catálogo**: fila en `public.games`. Si el juego reutiliza un slug simulado existente (`bloque-buster`, `caida`, `serpentina`, `gloton`, `invasores`, `ranaria`, `duelo-pixel`) no hay `insert`; a lo sumo una migración `update` del `long`. Si es un slug nuevo, migración `supabase/migrations/<timestamp>_game_<slug>.sql` con `insert` (columnas: `id`, `title`, `short`, `long`, `cat`, `cover`, `color`, `sort_order`), aplicada con `apply_migration` con el mismo nombre y contenido, más la clase `.cover-<slug>` en `app/globals.css`.
5. **Leaderboard**: **no requiere cambios de esquema**. `scores` referencia `games(id)`, y `top_scores`, `game_stats`, `saveScore`, `/juegos/[id]` y `/salon` ya funcionan para cualquier `id` presente en `games`. La spec solo verifica que el puntaje del nuevo juego se guarda y aparece.
6. **Contrato de stats**: si `components/games/types.ts` todavía contiene `tripleLeft` (campo exclusivo de Asteroids), la spec debe incluir como **primer paso** generalizar el contrato (ver abajo). Si ya está generalizado, omitir el paso.

### Generalización del contrato (cuando aplique)

```ts
export type GameStat = { label: string; value: string };
export type GameStats = {
  score: number;
  lives: number | null; // null = el juego no tiene vidas
  level: number;
  extras?: GameStat[]; // stats propios del juego, el HUD los pinta genéricos
};
```

Cambios que describe la spec (sin escribir el código): `game-player.tsx` pinta `extras` como `.hud-stat` y oculta "Vidas" si `lives` es `null`; `AsteroidsEngine` migra `tripleLeft` a `extras: [{ label: 'Triple', value: 'Ns' }]` solo mientras esté activo; `rocas` no cambia visualmente. Ese paso debe dejar `rocas` funcionando y verificable por sí solo.

## Flujo del comando

Responde siempre en el idioma del prompt inicial (normalmente español). Sigue las fases en orden y **nunca saltes la Fase 2**.

### Fase 1 — Contexto

1. Lee `CLAUDE.md` y `AGENTS.md` si existen.
2. Lee `specs/05-juego-asteroides.md` y `specs/06-leaderboard-y-tabla-de-juegos.md`, y cualquier spec posterior de un juego o del contrato, para heredar redacción, nombres de secciones y estados (`Borrador`, `Aprobado`, `Implementado`...).
3. Lee `template.md` (en este mismo directorio).
4. Si `$ARGUMENTS` viene vacío, pide una descripción del juego en **una frase**. Si no cabe en una frase, sugiere dividir.
5. Deduce el slug candidato (kebab-case) y comprueba en el contexto de sesión si ya existe `lib/games/<slug>/`. Si existe, la spec **reutiliza ese motor** (describe qué falta: componente, registro, catálogo) en lugar de pedir escribirlo. Lee su `engine.ts` para citar su API real.
6. Si el juego tiene un original en una carpeta hermana (`../0X-*`) o en `lib/games`, léelo para fijar constantes y reglas; esa carpeta **nunca se modifica**.

### Fase 2 — Preguntas

Usa `AskUserQuestion` en bloques de 3 a 4 preguntas, con tu recomendación primero y marcada. No preguntes lo que ya se deduce del contexto o de la descripción. Categorías obligatorias:

- **Catálogo**: ¿reutiliza un slug simulado o es uno nuevo? Si es nuevo: `title`, `short`, `long`, `cat` (`ARCADE | PUZZLE | SHOOTER | VERSUS`), `color` (`cyan | magenta | yellow | green`), `cover` (clase existente o `cover-<slug>` nueva) y `sort_order`.
- **Jugabilidad**: reglas, controles (teclas y el texto exacto de `controls` para la barra inferior del `.crt`), puntuación exacta por evento, vidas (¿tiene? si no, `lives: null`), niveles y condición de fin de partida.
- **Stats extra** para el HUD (`extras`): cuáles, formato y cuándo cambian.
- **Render**: resolución lógica (por defecto 800×600, 4:3) y estilo visual (vectorial blanco como Asteroids, o paleta neón).
- **Origen del motor**: desde cero, o portar código existente (¿dónde está?).
- **Fuera de alcance** (confirmar por defecto): controles táctiles y móvil, sonido, `devicePixelRatio`, anti-trampa del puntaje, tests automatizados, `best`/`plays` ficticios.
- **Cosas ya decididas** que no se deben reabrir.

Si surge algo que merece su propia spec (multijugador, modo CPU, editor de niveles), señálalo y propón dejarlo fuera.

**Cuándo parar**: cuando puedas responder sin suponer (1) qué archivos aparecen o cambian, (2) cuál es el primer y el último paso ejecutable, y (3) cómo se verifica que está terminado.

### Fase 3 — Escribir la spec

Si ya tienes toda la información, escribe la spec completa de una vez y pasa a la Fase 4, sin pedir confirmación sección por sección. Solo si falta información, desarrolla sección por sección y confirma cada una.

Sigue `template.md`. Reglas de contenido:

- Un solo objetivo en una frase en la cabecera.
- Nombres concretos de archivos, clases, constantes y claves; nada de "el módulo del juego".
- Cada paso del plan deja el sistema funcional y es commiteable por sí solo; ninguno supera ~50 líneas de código; el último paso no es "probar todo".
- Los criterios de aceptación son booleanos y verificables.
- Sin TODOs: una decisión no tomada se anota como pendiente con su motivo, o se pregunta.
- Sin código largo: solo firmas, tipos y SQL corto.
- El trabajo de UI (cover, HUD, estados) indica usar `/frontend-design`, como exige `CLAUDE.md`.
- Antes de código de Next, la spec indica leer la guía relevante en `node_modules/next/dist/docs/` (según `AGENTS.md`).

### Fase 4 — Guardar

1. Número: el más alto de `specs/` + 1, con dos dígitos. Nombre: `specs/NN-juego-<slug>.md`.
2. Fecha: la del contexto de sesión. Estado: `Borrador`.
3. `Depends on`: `SPEC 05, SPEC 06` más cualquier spec posterior que el juego necesite (p. ej. la que generalizó el contrato). Comprueba que cada una exista en `specs/`; si no, díselo al usuario en vez de dejar una referencia colgante.
4. Escribe el archivo directamente, sin pedir permiso. Solo pregunta si ya existe.
5. Si falta `specs/.spec-config.yml`, no lo crees aquí: lo gestiona `/spec`.
6. Confirma al usuario: ruta del archivo, que está en `Borrador` y debe pasarlo a `Aprobado` tras revisarlo, y que el siguiente paso es `/spec-impl NN-juego-<slug>`. **Detente ahí.**

## Reglas duras

- **Nunca escribes código** ni migraciones; solo el `.md` de la spec.
- **Nunca propones implementar** tras guardar.
- **Nunca asumes** decisiones que el usuario no confirmó.
- **No modificas** carpetas `../0X-*` ni sus juegos originales.
- No dupliques lógica del leaderboard: si la spec pide cambiar `scores`, `top_scores` o `saveScore`, es señal de que el alcance es otro y hay que preguntar.
- Textos de UI de la spec y del juego, en español.
- Si el usuario quiere saltarse la Fase 2, recuérdale: "Las preguntas ahora ahorran horas después. ¿Seguro que quieres saltarlas?". Si insiste, regístralo en Decisiones ("Definición rápida sin aclaraciones detalladas").
- Si el juego es demasiado grande (no cabe en una frase, toca más de tres áreas o exige decisiones en cuatro o más dominios), propón dividirlo en varias specs.

## Argumentos

`$ARGUMENTS` es la descripción del juego, no el nombre del archivo. Excepción: si es un único token kebab-case sin espacios (p. ej. `/spec-juego tetris`), úsalo como slug y como semilla de la descripción, sin pedir confirmación.
