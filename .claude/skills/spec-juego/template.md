# Plantilla de spec de juego para Arcade Vault

Referencia que consulta `/spec-juego`. Destilada de `specs/05-juego-asteroides.md` y `specs/06-leaderboard-y-tabla-de-juegos.md`. **No es texto para copiar tal cual**: es la forma que debe respetar la spec. Reemplaza `<slug>`, `<Nombre>` y los valores entre `<>` con datos reales.

---

## Cabecera

```markdown
# SPEC NN — <Nombre del juego> como juego real con leaderboard

> **Status:** Borrador
> **Depends on:** SPEC 05, SPEC 06
> **Date:** YYYY-MM-DD
> **Objective:** Una sola frase: portar/crear <Nombre> como componente que `GamePlayer` carga desde el registro para el id `<slug>`, reportando stats y fin de partida, con su puntaje en el leaderboard.
```

Estados válidos: `Borrador`, `En revisión`, `Aprobado`, `Implementado`, `Obsoleto`.

---

## Por qué existe esta spec

Un párrafo corto: qué juego es, de dónde viene (desde cero / carpeta `../0X-*` / motor ya en `lib/games`), y qué entrega respecto al contrato fijado en SPEC 05. Si esta es la spec que generaliza `GameStats`, dilo aquí.

---

## Alcance

**Dentro** (cada punto con ruta concreta; quitar los que no apliquen):

- Contrato (solo si `types.ts` aún tiene `tripleLeft`): `GameStats` con `lives: number | null` y `extras?: { label; value }[]`; `components/game-player.tsx` pinta `extras` y oculta "Vidas" con `lives === null`; `lib/games/asteroids/engine.ts` migra `tripleLeft` a `extras`.
- Motor: `lib/games/<slug>/engine.ts`, clase `<Nombre>Engine` con `constructor(canvas, callbacks)`, `start()`, `setPaused()`, `destroy()`. Sin globals; solo pinta el mundo; el HUD y el "GAME OVER" los dibuja la plataforma; el motor no reinicia solo (lo hace `GamePlayer` con `runId`).
- Componente: `components/games/<slug>-game.tsx` (`"use client"`), patrón de `asteroids-game.tsx`.
- Registro: entrada `<slug>` en `components/games/registry.ts` con `controls: '<TECLAS EN MAYÚSCULAS>'`.
- Catálogo (elegir una):
  - Slug existente: sin `insert`; migración `update` del `long` si cambia el texto.
  - Slug nuevo: `supabase/migrations/<timestamp>_game_<slug>.sql` con `insert into public.games`, aplicada con `apply_migration` (mismo nombre y contenido), y `.cover-<slug>` en `app/globals.css`.
- Regla de `.game-canvas` ya existente; no se redefine.

**Leaderboard:** sin cambios de esquema ni de código. `scores`, `game_stats`, `top_scores`, `saveScore`, `/juegos/[id]` y `/salon` operan sobre cualquier `id` de `games`.

**Fuera de alcance (specs futuras)** — conservar por defecto y añadir lo específico del juego:

- Controles táctiles y móvil (bajo 768 px el canvas se escala pero se controla con teclado).
- Sonido y música.
- Manejo de `devicePixelRatio` (resolución lógica fija).
- Anti-trampa: el puntaje lo envía el navegador y es falsificable (ver SPEC 06).
- Tests automatizados (no hay runner configurado).
- Migrar los demás juegos simulados.
- Modificar o borrar la carpeta original `../0X-*`.

---

## Modelo de datos

Firmas y constantes reales, sin implementar:

```ts
// lib/games/<slug>/engine.ts
export class <Nombre>Engine {
  constructor(canvas: HTMLCanvasElement, callbacks: EngineCallbacks);
  start(): void; // inicia rAF y listeners de teclado
  setPaused(paused: boolean): void;
  destroy(): void; // cancela rAF y quita todos los listeners
}
```

- Constantes del juego con nombre y valor (`W`, `H`, velocidades, puntos por evento, duraciones...).
- Tabla "evento → puntos" exacta.
- Stats que reporta: `score`, `lives` (número o `null`), `level`, y cada `extras` con su `label` y formato de `value`.
- Si es slug nuevo, el `insert` con todos los campos:

```sql
insert into public.games (id, title, short, long, cat, cover, color, sort_order)
values ('<slug>', '<TÍTULO>', '<short>', '<long>', '<CAT>', 'cover-<slug>', '<color>', <n>);
```

Convenciones fijas:

- El canvas solo pinta el mundo; HUD y overlay de fin no se dibujan en él.
- `onStats` solo ante cambios, nunca por frame.
- `onGameOver` una sola vez por partida.
- `preventDefault` de las teclas de control solo mientras el motor esté montado y el foco no esté en `input` o `textarea` (campo de iniciales del modal).
- Tope de `dt` de 0,05 s y `lastTime` reiniciado al reanudar.
- Textos de UI en español.

---

## Plan de implementación

Cada paso deja el sistema funcional y es commiteable. Antes de escribir código de Next, leer la guía relevante en `node_modules/next/dist/docs/` (según `AGENTS.md`). Usar `/frontend-design` para HUD, cover y estados (según `CLAUDE.md`).

1. _(Solo si aplica)_ Generalizar el contrato `GameStats` y migrar Asteroids. Verificar: `npx tsc --noEmit`, `npm run lint`, `/juegos/rocas/jugar` sin cambios visibles (el triple sigue apareciendo).
2. Crear `lib/games/<slug>/engine.ts`. Verificar: `npx tsc --noEmit` y `npm run lint`.
3. Crear `components/games/<slug>-game.tsx`. Verificar: `npx tsc --noEmit`.
4. Registrar `<slug>` en `registry.ts`. Verificar: `/juegos/<slug>/jugar` monta el canvas y el HUD refleja las stats.
5. Catálogo: migración (`insert` o `update`) aplicada con `apply_migration`, y cover CSS si es nuevo. Verificar: `list_migrations`, `select id from public.games order by sort_order`, `get_advisors` (security) sin hallazgos nuevos, y `/biblioteca` muestra el juego con `—` y `0`.
6. Verificación manual en `npm run dev` (puede usarse el MCP de Playwright): jugar hasta el fin, guardar el puntaje, comprobar la fila con `execute_sql` y que aparece en `/juegos/<slug>` y `/salon`. Luego `npm run build`.

---

## Criterios de aceptación

Base reutilizable (adaptar valores concretos):

- [ ] `npm run build`, `npm run lint` y `npx tsc --noEmit` terminan sin errores.
- [ ] `/juegos/<slug>/jugar` muestra el canvas 800×600 dentro del `.crt` con relación 4:3 y el estado inicial descrito en la spec.
- [ ] Los controles `<teclas>` funcionan y la página no hace scroll con ellas mientras se juega.
- [ ] `<evento>` suma exactamente `<n>` puntos y el valor aparece en el HUD de React.
- [ ] El HUD muestra vidas (o las oculta si `lives` es `null`), nivel y cada stat extra con el formato definido.
- [ ] Al terminar la partida se abre el modal "FIN DEL JUEGO" con la puntuación final correcta; no hay overlay de fin dentro del canvas.
- [ ] El campo de iniciales del modal acepta espacios y letras sin que el juego reaccione ni la página haga scroll.
- [ ] "GUARDAR PUNTUACIÓN" crea una fila en `scores` con `game_id = '<slug>'`, el nombre escrito, la puntuación del HUD y `user_id` nulo, y muestra `▸ PUNTUACIÓN GUARDADA_`.
- [ ] Tras guardar, `/juegos/<slug>` y `/salon` muestran el puntaje al navegar a ellas sin reiniciar el servidor, y `Puntuaciones` aumenta en 1.
- [ ] "JUGAR DE NUEVO" arranca una partida limpia; PAUSA congela y REANUDAR continúa sin salto; FIN abre el modal; SALIR navega sin errores.
- [ ] Al salir de la ruta no quedan listeners de teclado ni `requestAnimationFrame` activos.
- [ ] Los juegos que siguen simulados (p. ej. `/juegos/caida/jugar`) y `rocas` funcionan igual que antes.
- [ ] `/biblioteca` y `/` muestran el juego en su `sort_order`; sin puntajes muestra `—` y `0`.
- [ ] No hay errores en consola ni advertencias de hidratación en `/juegos/<slug>/jugar`.

Evitar criterios no verificables ("funciona bien", "buena UX").

---

## Decisiones tomadas y descartadas

Formato **Sí / No** con motivo breve. Heredar y adaptar:

- **Sí:** motor como clase TS con `destroy()`; React 19 en modo estricto monta, desmonta y vuelve a montar efectos.
- **Sí:** registro `id → componente`; `GamePlayer` sigue siendo el contenedor común (pausa, modal, guardado).
- **Sí:** el fin de partida lo gestiona la plataforma; no hay reinicio propio en el canvas.
- **Sí:** el puntaje se guarda con la Server Action `saveScore` existente; **No:** tabla o columna propia por juego.
- **Sí:** `onStats` solo ante cambios para no re-renderizar `GamePlayer` 60 veces por segundo.
- Decisiones propias del juego: slug nuevo vs. existente, estilo visual, vidas, `extras`.

---

## Riesgos identificados

Filas heredadas (omitir las que no apliquen):

| Riesgo                                                                                                | Mitigación                                                                                                   |
| ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Listeners o `requestAnimationFrame` quedan activos tras desmontar (modo estricto)                     | `destroy()` los limpia; criterio de aceptación específico.                                                   |
| Espacio activa el botón PAUSA enfocado o hace scroll                                                  | `preventDefault` en `keydown`/`keyup` de las teclas de control mientras se juega.                            |
| Capturar teclas rompe el campo de iniciales                                                           | No hacer `preventDefault` con foco en `input`/`textarea`; el motor está pausado con el modal abierto.        |
| Desajuste de hidratación                                                                              | Canvas y motor se crean solo en efectos; sin `Math.random` ni medidas del DOM en el render.                  |
| Salto de `dt` tras pausar o cambiar de pestaña                                                        | Tope de `dt` de 0,05 s y `lastTime` reiniciado al reanudar.                                                  |
| El catálogo está cacheado (`use cache`, tags `games` y `scores`) y un `insert` por migración no se ve | En desarrollo se ve al recargar o reiniciar; `npm run build` lo regenera. Documentar en el paso de catálogo. |
| El original contradice su propio README                                                               | Fuente de verdad: el código del juego.                                                                       |

---

## Lo que **no** está en esta spec

Repetir al final, de forma explícita, lo que queda fuera (táctil, sonido, `devicePixelRatio`, anti-trampa, tests, otros juegos, enemigos o modos no implementados en el original). Cada uno, si se aborda, va en su propia spec.

---

## Reglas globales del documento

- Una idea por frase.
- Nombres concretos de archivos, clases y claves.
- Sin TODOs: decisión pendiente = pregunta o nota con motivo.
- Sin funciones completas: solo firmas, tipos y SQL corto.
- Markdown estándar, renderizable en GitHub.
- Redacción y encabezados en español, iguales a SPEC 05 y SPEC 06.
