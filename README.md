## Arcade Vault

Es una plataforma para jugar online y competir por la mayor cantidad de puntos.

## Usa Spec Driven Design

Basado en /spec y /spec-impl

Siguiendo las buenas practicas recomendadas aquí:
https://github.com/Klerith/fernando-skills

## Skills usadas

```bash
npx skills@latest add Klerith/fernando-skills
```

## Commands

```bash
npm run dev      # next dev
npm run build    # next build
npm run start    # next start
npm run lint     # eslint (flat config, next core-web-vitals + typescript)
npx tsc --noEmit # type check
```

## Base de datos (Supabase)

La app usa el proyecto de Supabase `vcaqsiowjzymzyiuypoj`. Copia `.env.example` a `.env.local` y completa:

- `NEXT_PUBLIC_SUPABASE_URL`: URL del proyecto.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: clave publishable (`sb_publishable_...`). Es pública por diseño; la seguridad la dan las políticas RLS. No uses la clave `service_role` en el cliente.

Clientes: `lib/supabase/client.ts` (navegador) y `lib/supabase/server.ts` (servidor). No importes uno desde el lado del otro.

Comprobar la conexión con el servidor en marcha: `GET /api/health` responde `{"ok":true,"ping":"pong"}`.

`next build` consulta la base (`generateStaticParams` y las páginas que leen el catálogo), así que necesita red y `.env.local` con las dos variables.

### Esquema de dominio

| Objeto | Qué es |
| --- | --- |
| `public.games` | Catálogo (8 juegos sembrados): `id` (slug), `title`, `short`, `long`, `cat`, `cover`, `color`, `sort_order`. Lectura pública. |
| `public.scores` | Puntajes: `game_id` (FK a `games`), `name` (1–10), `score` (0–1.000.000), `user_id` (nulo por ahora), `created_at`. Lectura pública; inserción pública solo con `user_id` nulo; sin update ni delete. |
| `public.game_stats` | Vista `security_invoker` con `plays` (puntajes guardados) y `best` por juego. |
| `public.top_scores(p_game_id, p_limit)` | Función SQL `security invoker`: top N por juego (`p_game_id` nulo = todos), empates por antigüedad. |

Flujo de puntajes: `components/game-player.tsx` llama a la Server Action `saveScore` (`app/juegos/[id]/jugar/actions.ts`), que valida con `lib/score-input.ts`, inserta con `lib/supabase/public.ts` y llama a `updateTag('scores')`. Las lecturas (`lib/games.ts`, `lib/scores.ts`) usan `use cache` con las etiquetas `games` y `scores`. Los puntajes son anónimos y los envía el navegador, así que son falsificables; solo hay límites de rango.

**Recordatorio:** tras cada migración ejecuta `get_advisors` (security y performance). Los avisos conocidos son `rls_auto_enable()` (`SECURITY DEFINER`, no es de este esquema) y la clave foránea `scores.user_id` sin índice (INFO; se indexará cuando haya auth).

### Migraciones

El esquema vive en `supabase/migrations/`, un archivo SQL por cambio, nombrado `YYYYMMDDHHMMSS_descripcion.sql`.

1. Aplica el cambio al proyecto con el MCP de Supabase (`apply_migration`).
2. Consulta `list_migrations` y guarda el SQL en `supabase/migrations/` con la versión que devuelve, para que el archivo y el proyecto coincidan.
3. Ejecuta `get_advisors` (security) y corrige los hallazgos nuevos antes de hacer commit.
4. No edites una migración ya aplicada: añade otra.
