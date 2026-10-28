# SPEC 06 — Tabla de juegos y leaderboard reales en Supabase

> **Status:** Aprobado
> **Depends on:** SPEC 01, SPEC 04, SPEC 05
> **Date:** 2026-10-28
> **Objective:** Mover el catálogo de juegos a una tabla `games` de Supabase y guardar y mostrar los puntajes en una tabla `scores` (ranking en `/salon` y en `/juegos/[id]`, con `best` y `plays` calculados), reemplazando los datos mock y `localStorage` para puntajes.

---

## Por qué existe esta spec

Tras la SPEC 04 el proyecto de Supabase está conectado pero vacío, y tras la SPEC 05 el primer juego real ya reporta un puntaje al modal. Hoy ese puntaje se guarda en `localStorage` (`av_scores`), nadie lo lee, y el ranking que se ve (`seededScores`) y los números `best` y `plays` del catálogo son inventados. Esta spec crea el esquema de dominio y conecta las pantallas a él.

Las dos mitades (juegos y puntajes) van juntas porque `scores` referencia a `games` y un ranking sin catálogo real no se puede mostrar. La autenticación sigue fuera: los puntajes son anónimos y la tabla deja `user_id` preparado para enlazarlos después.

---

## Alcance

**Dentro:**

- Dos migraciones en `supabase/migrations/` aplicadas con el MCP (`apply_migration`):
  - `games`: tabla del catálogo, sembrada con los 8 juegos de `GAMES` de `lib/games.ts`.
  - `scores`: tabla de puntajes, vista `game_stats` y función `top_scores`.
- RLS en ambas tablas: lectura pública; inserción pública en `scores` solo con `user_id` nulo.
- Cliente de Supabase sin cookies, `lib/supabase/public.ts`, para lecturas cacheadas con `use cache` y para insertar desde la Server Action.
- `lib/games.ts` deja de ser un arreglo y pasa a funciones asíncronas `getGames()` y `getGame(id)` (con `use cache` y `cacheTag`) que devuelven cada juego con `best` y `plays` reales.
- `lib/scores.ts` sustituye a `seededScores` por `getTopScores(gameId, limit)` y `getLeaderboards(limit)` (con `use cache` y `cacheTag`).
- `lib/score-input.ts`: validación de la entrada de un puntaje, separada de la acción como `lib/contact.ts` en la SPEC 03.
- Server Action `saveScore` en `app/juegos/[id]/jugar/actions.ts`: valida, inserta y llama a `updateTag`.
- Cambios en `components/game-player.tsx`: el botón "GUARDAR PUNTUACIÓN" llama a la Server Action, muestra estado de envío, y en fallo un mensaje genérico con opción de reintentar.
- Eliminar `saveScore`, `SCORES_KEY` (`av_scores`) y el tipo `SavedScore` de `components/session-provider.tsx` y `lib/types.ts`. `av_user` no se toca.
- `/juegos/[id]`: ranking top 10 desde la base, `Partidas` y `Mejor global` reales, estado vacío.
- `/salon`: `app/salon/page.tsx` carga el top 12 de cada juego en el servidor y `components/hall-of-fame.tsx` lo recibe por props; estado vacío por juego; se elimina el bloque "TU MEJOR MARCA".
- `/biblioteca` y `/` (vista previa de juegos): leen el catálogo de la base; las tarjetas muestran `best` real o `—`.
- Documentar en `README.md` el esquema (tablas, vista, función) y el recordatorio de revisar `get_advisors`.

**Fuera de alcance (specs futuras):**

- Autenticación y enlazar puntajes a un usuario (`user_id` queda nulo siempre). Sin auth no hay "tu mejor marca" real.
- Anti-trampa: el puntaje lo envía el navegador y es falsificable; solo hay límites de rango. Puntaje firmado por el motor o rate limit van en otra spec.
- Realtime: el ranking no se actualiza en vivo; se ve al recargar o navegar.
- Contar partidas jugadas (sin guardar): `plays` es el número de puntajes guardados.
- Los datos mock de la home en `lib/home.ts` (`HOME_STATS`, `RECENT_SCORES`, `TOP_PLAYERS`).
- Migrar los otros 7 juegos fuera de la simulación (ver SPEC 05).
- Tipos TypeScript generados desde el esquema; se definen a mano en `lib/types.ts`.
- Panel de administración del catálogo o edición de juegos desde la app.
- Paginación del ranking más allá del top 10 / top 12.

---

## Modelo de datos

```sql
-- supabase/migrations/<timestamp>_games.sql
create table public.games (
  id         text primary key,                 -- slug: 'rocas', 'caida'...
  title      text not null,
  short      text not null,
  long       text not null,
  cat        text not null check (cat in ('ARCADE','PUZZLE','SHOOTER','VERSUS')),
  cover      text not null,                    -- clase CSS: 'cover-bricks'
  color      text not null check (color in ('cyan','magenta','yellow','green')),
  sort_order int  not null,
  created_at timestamptz not null default now()
);
alter table public.games enable row level security;
create policy games_read on public.games for select to anon, authenticated using (true);
grant select on public.games to anon, authenticated;
```

```sql
-- supabase/migrations/<timestamp>_scores.sql
create table public.scores (
  id         uuid primary key default gen_random_uuid(),
  game_id    text not null references public.games (id),
  name       text not null check (char_length(name) between 1 and 10),
  score      integer not null check (score between 0 and 1000000),
  user_id    uuid null references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index scores_game_score_idx on public.scores (game_id, score desc, created_at);
alter table public.scores enable row level security;
create policy scores_read   on public.scores for select to anon, authenticated using (true);
create policy scores_insert on public.scores for insert to anon, authenticated
  with check (user_id is null);
grant select, insert on public.scores to anon, authenticated;

-- plays y best por juego; security_invoker para respetar RLS de scores
create view public.game_stats with (security_invoker = true) as
  select game_id, count(*)::int as plays, max(score) as best
  from public.scores group by game_id;
grant select on public.game_stats to anon, authenticated;

-- top N por juego (p_game_id nulo = todos los juegos), empates por antigüedad
create function public.top_scores(p_game_id text default null, p_limit int default 10)
returns table (game_id text, rank int, name text, score int, created_at timestamptz)
language sql stable security invoker set search_path = '';
-- cuerpo: row_number() over (partition by game_id order by score desc, created_at asc) <= p_limit
grant execute on function public.top_scores(text, int) to anon, authenticated;
```

Tipos en `lib/types.ts` (cambian `Game` y `ScoreRow`; se elimina `SavedScore`):

```ts
export type Game = {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: Category;
  cover: string;
  color: GameColor;
  best: number | null; // null si aún no hay puntajes
  plays: number; // puntajes guardados
};

export type ScoreRow = {
  rank: number;
  name: string;
  score: number;
  date: string; // dd/mm/aaaa, formateado en el servidor en UTC
};
```

```ts
// lib/games.ts
export const CATS: string[]; // se conserva en código
export async function getGames(): Promise<Game[]>; // use cache, cacheTag('games', 'scores'), orden sort_order
export async function getGame(id: string): Promise<Game | undefined>;
export function formatPlays(n: number): string; // 0..999 tal cual; 12400 -> "12.4K"

// lib/scores.ts
export async function getTopScores(
  gameId: string,
  limit: number,
): Promise<ScoreRow[]>; // cacheTag('scores')
export async function getLeaderboards(
  limit: number,
): Promise<Record<string, ScoreRow[]>>; // una llamada a top_scores(null, limit)

// app/juegos/[id]/jugar/actions.ts
export type SaveScoreState =
  | { status: 'idle' }
  | { status: 'success' }
  | { status: 'error'; message: string };
export async function saveScore(
  gameId: string,
  name: string,
  score: number,
): Promise<SaveScoreState>;
```

Convenciones:

- Tags de caché: `games` (catálogo) y `scores` (ranking y estadísticas). `getGames`/`getGame` usan ambos porque incluyen `best` y `plays`.
- `saveScore` llama a `updateTag('scores')` (API de Server Actions para leer lo que acabas de escribir; ver `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/updateTag.md`). No usa `revalidateTag` con un solo argumento, que está deprecado.
- La validación de `lib/score-input.ts` repite las reglas de la base: `name` recortado de 1 a 10 caracteres sin saltos de línea ni caracteres de control, `score` entero entre 0 y 1.000.000, `gameId` no vacío. El detalle del error va a `console.error` en el servidor; al cliente solo llega un mensaje genérico en español.
- `lib/supabase/public.ts` exporta `createPublicClient()` con `createClient` de `@supabase/supabase-js`, las mismas dos variables de entorno que SPEC 04 (con la misma comprobación y error con el nombre de la variable) y sin persistir sesión. No lee `cookies()`, porque las funciones con `use cache` no pueden.
- Fechas formateadas en el servidor con `toLocaleDateString('es-ES', { timeZone: 'UTC' })` para no provocar desajuste de hidratación.
- Los textos de UI van en español, igual que el resto de la plataforma.

---

## Plan de implementación

Antes de escribir código de Next, leer la guía relevante en `node_modules/next/dist/docs/` (según `AGENTS.md`): `use-cache.md`, `cacheTag`, `updateTag.md`, Server Actions y la interacción con `cacheComponents` y `generateStaticParams`. Usar `/frontend-design` para el trabajo de UI (según `CLAUDE.md`): aquí aplica a los estados vacíos, al estado de guardado del modal y al podio del salón, reutilizando las clases existentes.

1. Crear `supabase/migrations/<timestamp>_games.sql` con la tabla, RLS, grant y la siembra de los 8 juegos tomados de `lib/games.ts` (con el `long` actual de `rocas` de la SPEC 05 y `sort_order` según la posición en el arreglo), y aplicarla con `apply_migration` (mismo nombre y contenido). Verificar: `list_migrations` la muestra, `select count(*) from public.games` devuelve 8 y `get_advisors` (security) no reporta hallazgos nuevos.
2. Crear `supabase/migrations/<timestamp>_scores.sql` con `scores`, índice, políticas, vista `game_stats` y función `top_scores`, y aplicarla. Verificar con `execute_sql` en una transacción con `rollback`: como `anon` se puede insertar con `user_id` nulo, falla con `user_id` no nulo, con `score` -1, con `score` 1000001 y con `name` vacío o de 11 caracteres; `top_scores('rocas', 10)` ordena por puntaje y desempata por fecha; `game_stats` devuelve `plays` y `best`. Ejecutar `get_advisors` (security y performance).
3. Crear `lib/supabase/public.ts`. Cambiar `lib/types.ts` (`Game`, `ScoreRow`) y reescribir `lib/games.ts` con `getGames`, `getGame`, `formatPlays` y `CATS`. Migrar consumidores del catálogo: `app/page.tsx`/`components/home/home-page.tsx`, `app/biblioteca/page.tsx` (pasa `games` a `Library` por props), `components/library.tsx`, `components/game-card.tsx` (muestra `—` si `best` es nulo y `formatPlays`), `app/juegos/[id]/page.tsx`, `app/juegos/[id]/jugar/page.tsx` y los dos `generateStaticParams`. El detalle y el salón conservan por ahora `seededScores`. Verificar: `npx tsc --noEmit`, `npm run lint`, y `/`, `/biblioteca`, `/juegos/rocas` y `/juegos/rocas/jugar` cargan con los 8 juegos desde la base.
4. Crear `lib/score-input.ts` y `app/juegos/[id]/jugar/actions.ts` (`saveScore`). Modificar `components/game-player.tsx`: llamar a la acción desde "GUARDAR PUNTUACIÓN" con `useTransition`, deshabilitar el botón mientras envía, mostrar el error genérico con el modal abierto y permitir reintentar, y mostrar `▸ PUNTUACIÓN GUARDADA_` solo en éxito. Eliminar `saveScore`, `SCORES_KEY` y `SavedScore` de `session-provider.tsx` y `lib/types.ts`. Verificar: jugar `rocas` hasta el fin, guardar, y comprobar con `execute_sql` que existe la fila con `game_id = 'rocas'`, la puntuación del HUD y `user_id` nulo.
5. Crear `lib/scores.ts` (`getTopScores`) y usarlo en `app/juegos/[id]/page.tsx`: ranking top 10 desde la base, `Partidas` (renombrada `Puntuaciones` en la etiqueta) y `Mejor global` reales, y estado vacío "AÚN NO HAY PUNTUACIONES". Verificar: tras guardar un puntaje en el paso 4, `/juegos/rocas` lo muestra sin recargar la caché a mano y `Mejor global` coincide.
6. Añadir `getLeaderboards` a `lib/scores.ts`. Hacer `app/salon/page.tsx` un componente de servidor que carga `getGames()` y `getLeaderboards(12)` y los pasa a `HallOfFame` por props; en `components/hall-of-fame.tsx` quitar `seededScores` y el bloque "TU MEJOR MARCA", y manejar podio y tabla con menos de 3 filas y con cero filas (estado vacío por juego). Eliminar `seededScores` y `PLAYERS` de `lib/scores.ts` si no los usa nadie. Verificar: `/salon` muestra el puntaje guardado en la pestaña de `rocas` y el estado vacío en los demás juegos.
7. Documentar en `README.md` el esquema y el flujo de datos de puntajes, y ejecutar `get_advisors` (security) confirmando que no hay hallazgos nuevos salvo los documentados en Riesgos. Verificación manual completa en `npm run dev` (puede hacerse con el MCP de Playwright) y luego `npm run build`.

---

## Criterios de aceptación

- [x] `npm run build`, `npm run lint` y `npx tsc --noEmit` terminan sin errores.
- [x] Existen `supabase/migrations/<timestamp>_games.sql` y `<timestamp>_scores.sql`, y `list_migrations` del proyecto muestra ambas aplicadas con el mismo nombre.
- [x] `select count(*) from public.games` devuelve 8 y los `id` coinciden con los anteriores (`bloque-buster`, `caida`, `serpentina`, `gloton`, `rocas` y los otros tres).
- [x] Con rol `anon` se inserta una fila en `scores` con `user_id` nulo; fallan los inserts con `user_id` no nulo, `score` fuera de 0–1.000.000, `name` vacío o de más de 10 caracteres y `game_id` inexistente.
- [x] Con rol `anon` no se puede hacer `update` ni `delete` sobre `scores` ni `games`, ni `insert` sobre `games`.
- [x] `get_advisors` (security) no reporta tablas sin RLS ni vistas `SECURITY DEFINER` atribuibles a esta spec.
- [x] No existe ninguna referencia a `service_role` ni a la clave `anon` legacy, y `seededScores`, `av_scores` y `SavedScore` ya no aparecen en el repositorio.
- [x] `/biblioteca` y `/` muestran los 8 juegos en el orden de `sort_order`, y el filtro por categoría y la búsqueda siguen funcionando.
- [x] Un juego sin puntajes muestra `—` como mejor puntuación y `0` en la tarjeta y en el detalle; no se muestran números mock.
- [x] En `/juegos/rocas/jugar`, al terminar la partida y pulsar "GUARDAR PUNTUACIÓN" se crea una fila en `scores` con el nombre del campo, la puntuación mostrada y `user_id` nulo, y aparece `▸ PUNTUACIÓN GUARDADA_`.
- [x] Mientras la acción está en curso el botón queda deshabilitado, y no se puede guardar dos veces la misma partida (el botón desaparece tras el éxito, como ahora).
- [x] Si la inserción falla (por ejemplo, con `NEXT_PUBLIC_SUPABASE_URL` inválida), el modal sigue abierto, muestra un mensaje genérico en español sin detalle técnico ni valores de entorno, y "GUARDAR PUNTUACIÓN" sigue disponible; el detalle aparece solo en el log del servidor.
- [x] La acción rechaza desde el servidor un nombre vacío o de 11 caracteres, un puntaje negativo, mayor a 1.000.000 o no entero, y un `gameId` inexistente, con el mismo mensaje genérico.
- [x] Tras guardar un puntaje, `/juegos/rocas` y `/salon` lo muestran al navegar a ellas sin reiniciar el servidor, y `Puntuaciones` aumenta en 1.
- [x] `/juegos/[id]` lista como máximo 10 puntajes ordenados de mayor a menor, con empates por antigüedad, formato `#01`, nombre, fecha `dd/mm/aaaa` y puntaje con separador de miles `es-ES`.
- [x] `/salon` muestra por pestaña de juego como máximo 12 filas; con 0, 1, 2 o 3 puntajes no falla y muestra el podio solo con los puestos que existen, y con 0 muestra un estado vacío en español.
- [x] `/salon` ya no muestra "TU MEJOR MARCA" ni datos inventados, con o sin sesión en `av_user`.
- [x] La sesión (`av_user`) y las pantallas `/auth`, `/acerca` y `/juegos/caida/jugar` (simulación) siguen funcionando igual que antes.
- [x] No hay errores en consola ni advertencias de hidratación en `/`, `/biblioteca`, `/juegos/rocas`, `/juegos/rocas/jugar` y `/salon`.
- [x] `README.md` documenta tablas, vista, función y el recordatorio de `get_advisors`.

---

## Decisiones tomadas y descartadas

- **Sí:** una sola spec para `games` y `scores`. Son interdependientes por la clave foránea y un ranking sin catálogo real no se puede mostrar; cabe porque auth y realtime quedan fuera.
- **No:** dividir en dos specs (06 catálogo, 07 leaderboard). Habría dejado una primera spec sin cambio visible.
- **Sí:** puntajes anónimos con `user_id uuid null` ya creado. Evita depender de la spec de auth y permite enlazar después sin migración destructiva.
- **No:** exigir usuarios autenticados. Obligaría a hacer antes la spec de auth (`/auth`, nav, `session-provider`).
- **Sí:** insertar mediante Server Action con cliente de servidor, no desde el navegador. Valida en servidor como `sendContact` (SPEC 03), permite `updateTag` y deja RLS y `CHECK` como segunda barrera.
- **No:** insert directo con `lib/supabase/client.ts`. Menos código, pero sin validación propia ni forma limpia de invalidar la caché de Next.
- **Sí:** aceptar el puntaje del navegador como falsificable y limitarlo con `CHECK` (0 a 1.000.000, nombre de 1 a 10). El anti-trampa real es otro dominio.
- **No:** rate limit por IP o huella ahora. Añade tablas, decisiones de privacidad y amplía el alcance.
- **Sí:** nombre de 1 a 10 caracteres, igual que el límite ya existente en el campo del modal (`slice(0, 10)`), en vez de un límite de 3 "iniciales".
- **Sí:** `best` y `plays` calculados con la vista `game_stats` (`security_invoker`), no guardados como columnas. No hay contadores que desincronizar y la vista respeta RLS.
- **No:** triggers que mantengan `best` y `plays` en `games`. Añaden lógica en la base que hoy no hace falta con este volumen.
- **Sí:** `plays` = puntajes guardados, no partidas jugadas. Es honesto con lo que se registra; por eso la etiqueta del detalle pasa a `Puntuaciones`.
- **No:** registrar cada partida terminada aunque no se guarde. Requeriría otra tabla o columna y decisiones de privacidad.
- **Sí:** valores reales desde cero, sin sembrar puntajes ficticios. El ranking arranca vacío con estados vacíos explícitos.
- **No:** sembrar `scores` desde `seededScores`, ni conservar `best_seed`/`plays_seed` en `games`. Mezclan datos falsos con reales y habría que limpiarlos.
- **Sí:** `games` guarda también `cover` y `color` (clases CSS y token de color). Hace del catálogo un único origen, aunque acople la base a nombres de clase. `GAME_REGISTRY` sigue en código porque son componentes.
- **No:** mapa en código para `cover`/`color`. Evita acoplar la base a CSS pero deja dos orígenes del catálogo.
- **Sí:** `id` slug como clave primaria de `games`. Ya es la clave de rutas, de `GAME_REGISTRY` y de `generateStaticParams`.
- **Sí:** `use cache` con `cacheTag` y `updateTag` en la Server Action. Las lecturas siguen cacheadas y se invalidan al guardar; `updateTag` da lectura inmediata de lo escrito.
- **No:** consultar la base en cada visita sin caché. Siempre fresco, pero choca con `generateStaticParams`, el prefetch y `cacheComponents`.
- **Sí:** cliente sin cookies (`lib/supabase/public.ts`) para lecturas e inserción. `use cache` no admite `cookies()` y no hay sesión que leer todavía.
- **Sí:** eliminar `saveScore`/`av_scores`. Un solo origen de verdad; nadie leía el `localStorage`.
- **No:** mantener copia local de puntajes. Deja código muerto y dos orígenes.
- **Sí:** error genérico en el modal con reintento y detalle solo en el log del servidor, igual que SPEC 03 y SPEC 04.
- **Sí:** quitar "TU MEJOR MARCA". Con puntajes anónimos no se puede saber cuáles son del usuario; volverá con la spec de auth.
- **Sí:** `top_scores` como función SQL con `row_number()`. El salón obtiene los 8 rankings en una sola llamada en vez de ocho.
- **Sí:** `lib/home.ts` sigue siendo mock (`RECENT_SCORES`, `TOP_PLAYERS`, `HOME_STATS`). Se migra cuando haya datos reales que mostrar en la home.

---

## Riesgos identificados

| Riesgo                                                                                                              | Mitigación                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| La inserción pública permite spam o puntajes falsos                                                                 | Aceptado y documentado en esta spec; `CHECK` y RLS limitan rango y forma. Rate limit y puntaje firmado van en otra spec.                                                    |
| `generateStaticParams` consulta la base en `next build` y el build falla si Supabase no responde o faltan variables | Las variables ya son obligatorias desde la SPEC 04; documentar en el README que el build necesita red y `.env.local`.                                                       |
| `cacheComponents` y `use cache`: leer `cookies()` dentro de una función cacheada rompe el render                    | Las lecturas usan `createPublicClient()` sin cookies; criterio de aceptación de que la acción y las lecturas funcionan con el servidor de desarrollo y con `npm run build`. |
| El ranking queda desactualizado tras guardar                                                                        | `updateTag('scores')` en la acción; criterio de aceptación de que el puntaje aparece al navegar sin reiniciar.                                                              |
| La vista `game_stats` ejecuta con permisos del dueño y salta RLS                                                    | Se crea con `security_invoker = true`; se comprueba con `get_advisors`.                                                                                                     |
| Funciones de la base sin `search_path` fijo generan advertencias de seguridad                                       | `top_scores` se crea con `set search_path = ''` y tablas calificadas con `public.`, como `ping()` en SPEC 04.                                                               |
| El `long` de `rocas` o los datos sembrados divergen del código anterior                                             | La siembra copia los textos actuales de `lib/games.ts` y el criterio de aceptación compara los 8 `id`.                                                                      |
| Hidratación: fechas formateadas con la zona horaria local                                                           | Se formatean en el servidor en UTC; el cliente solo recibe la cadena.                                                                                                       |
| `plays` se interpreta como partidas jugadas                                                                         | La etiqueta del detalle pasa a `Puntuaciones` y la decisión queda documentada.                                                                                              |

---

## Lo que **no** está en esta spec

- Autenticación, perfiles ni enlazar puntajes a usuarios, ni "tu mejor marca".
- Anti-trampa, rate limit ni puntajes firmados por el motor.
- Realtime, paginación del ranking, ni contar partidas no guardadas.
- Migrar `lib/home.ts` ni los otros 7 juegos fuera de la simulación.
- Panel de administración del catálogo.
- Tipos generados desde el esquema, Supabase CLI local ni Edge Functions.
- Cambios visuales fuera de los estados vacíos, el estado de guardado del modal y el podio del salón.

Cada uno, si se aborda, va en su propia spec.
