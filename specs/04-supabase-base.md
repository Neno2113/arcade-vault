# SPEC 04 — Base de Supabase: clientes, migraciones y verificación de conexión

> **Status:** Implementado
> **Depends on:** SPEC 03
> **Date:** 2026-10-27
> **Objective:** Conectar la app Next.js al proyecto de Supabase existente (`vcaqsiowjzymzyiuypoj`) con clientes de servidor y navegador, un flujo de migraciones versionado en el repo y una ruta `/api/health` que prueba la conexión de extremo a extremo.

---

## Por qué existe esta spec

"Implementar Supabase" abarca autenticación, puntajes, catálogo de juegos y más. Cada una es una decisión de dominio distinta y tocarlas juntas supera las tres áreas del sistema. Esta spec deja solo la **infraestructura común**: dependencias, variables de entorno, clientes, carpeta de migraciones y una comprobación. La sesión sigue en `localStorage` (`av_user`, `av_scores`) y los datos siguen siendo mock hasta las specs siguientes.

El proyecto de Supabase ya existe y está vacío (sin tablas en `public`). El MCP de Supabase ya está configurado en `.mcp.json`.

---

## Alcance

**Dentro:**

- Instalar `@supabase/supabase-js` y `@supabase/ssr`.
- Variables de entorno `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (clave **publishable**, no la `anon` legacy), añadidas a `.env.example` y a `.env.local`.
- Helper de cliente de navegador: `lib/supabase/client.ts`.
- Helper de cliente de servidor: `lib/supabase/server.ts`, basado en `cookies()` de Next.
- Carpeta `supabase/migrations/` con una migración mínima que crea la función `public.ping()`, aplicada al proyecto con el MCP (`apply_migration`).
- Route Handler `GET /api/health` que llama a `ping()` con el cliente de servidor y responde el resultado.
- Documentar en `README.md` el flujo de migraciones (crear archivo, aplicar, commit).

**Fuera de alcance (specs futuras):**

- Autenticación (login, registro, métodos, reemplazo de `av_user`) y el `proxy.ts` que refresca la sesión. Va en la spec de auth, que lo añadirá junto con su necesidad real.
- Tablas de dominio (`games`, `scores`, perfiles) y políticas RLS asociadas.
- Migrar los datos mock (`GAMES`, `seededScores`, `lib/home.ts`) a la base.
- Clave `service_role` y cualquier uso administrativo desde el servidor.
- Tipos TypeScript generados desde el esquema (`generate_typescript_types`); se añaden cuando existan tablas.
- Supabase CLI y entorno local con Docker, branching de bases de datos, Edge Functions, Storage y Realtime.
- Cambios visuales: ninguna pantalla cambia en esta spec.

---

## Modelo de datos

Una sola función SQL, sin tablas. No introduce datos persistentes.

```sql
-- supabase/migrations/<timestamp>_ping.sql
create or replace function public.ping()
returns text
language sql
security invoker
as $$ select 'pong'::text $$;

grant execute on function public.ping() to anon, authenticated;
```

Helpers de cliente:

```ts
// lib/supabase/client.ts
export function createClient(): SupabaseClient; // createBrowserClient(url, key)

// lib/supabase/server.ts
export async function createClient(): Promise<SupabaseClient>; // createServerClient(url, key, { cookies })
```

Respuesta de `/api/health`:

```ts
// 200
{ ok: true, ping: "pong" }
// 500 (detalle solo en el log del servidor)
{ ok: false }
```

Variables de entorno:

| Variable                               | Uso                                                                                                     |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | URL del proyecto (`https://vcaqsiowjzymzyiuypoj.supabase.co`).                                          |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clave publishable (`sb_publishable_...`). Es pública por diseño; la seguridad la dan las políticas RLS. |
| `SUPABASE_DB_PASSWORD`                 | Ya existe en `.env.example`; solo servidor, no se usa en el código de la app.                           |

Convenciones:

- Nombre de archivo de migración: `YYYYMMDDHHMMSS_descripcion.sql` (prefijo de 14 dígitos, como usa Supabase).
- Los dos clientes exportan `createClient` y leen las variables con comprobación; si falta alguna, lanzan un error con el nombre de la variable.
- Los valores reales nunca van en `.env.example`.

---

## Plan de implementación

Antes de escribir código de Next, leer la guía relevante en `node_modules/next/dist/docs/` (según `AGENTS.md`; en especial Route Handlers, `cookies()` y la interacción con `cacheComponents`). Esta spec no tiene UI, por lo que `/frontend-design` no aplica.

1. Instalar `@supabase/supabase-js` y `@supabase/ssr` (`npm install`). Añadir las dos variables a `.env.example` (sin valores) y a `.env.local` (con la URL y la clave publishable obtenidas con `get_project_url` y `get_publishable_keys`). Verificar con `npx tsc --noEmit`.
2. Crear `lib/supabase/client.ts` y `lib/supabase/server.ts` con las convenciones de arriba. Verificar con `npx tsc --noEmit` y `npm run lint`.
3. Crear `supabase/migrations/<timestamp>_ping.sql` con el SQL de arriba y aplicarlo con el MCP (`apply_migration`, mismo nombre y contenido). Verificar: `list_migrations` muestra la migración y `execute_sql` con `select public.ping()` devuelve `pong`.
4. Crear `app/api/health/route.ts`: `GET` que usa `createClient()` de servidor, ejecuta `supabase.rpc("ping")` y responde `{ ok: true, ping }` o `{ ok: false }` con estado 500, registrando el error con `console.error`. Verificar: con `npm run dev`, `GET /api/health` responde `200 {"ok":true,"ping":"pong"}`.
5. Documentar en `README.md` una sección corta "Base de datos" con las variables, cómo crear y aplicar una migración y el recordatorio de revisar `get_advisors` tras cada cambio de esquema. Ejecutar `get_advisors` (security) y confirmar que no reporta hallazgos nuevos por `ping()`.

---

## Criterios de aceptación

- [x] `npm run build`, `npm run lint` y `npx tsc --noEmit` terminan sin errores.
- [x] `package.json` incluye `@supabase/supabase-js` y `@supabase/ssr`.
- [x] `.env.example` lista `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` sin valores reales, y `.env.local` sigue ignorado por git.
- [x] No existe ninguna referencia a la clave `service_role` ni a la clave `anon` legacy en el repositorio.
- [x] Existe `supabase/migrations/<timestamp>_ping.sql` y `list_migrations` del proyecto muestra esa misma migración aplicada.
- [x] `select public.ping()` devuelve `pong` en el proyecto.
- [x] `GET /api/health` responde `200` con `{"ok":true,"ping":"pong"}`.
- [x] Con `NEXT_PUBLIC_SUPABASE_URL` vacía, `GET /api/health` responde `500` con `{"ok":false}` y el cuerpo no contiene el detalle del error ni valores de entorno; el detalle aparece solo en el log del servidor.
- [x] `lib/supabase/client.ts` no se importa desde ningún componente de servidor y `lib/supabase/server.ts` no se importa desde ningún componente cliente (`"use client"`).
- [x] No existe `proxy.ts` ni `middleware.ts` en el repositorio.
- [x] `get_advisors` (security) no reporta hallazgos nuevos atribuibles a esta spec.
- [x] Las pantallas `/`, `/biblioteca`, `/juegos/[id]`, `/juegos/[id]/jugar`, `/auth`, `/salon` y `/acerca` se ven y funcionan igual que antes (sesión y puntajes siguen en `localStorage`).
- [x] `README.md` documenta el flujo de migraciones.

---

## Decisiones tomadas y descartadas

- **Sí:** dividir "implementar Supabase" y dejar esta spec solo como base. Auth, puntajes y catálogo son dominios separados con decisiones propias; juntos superan las tres áreas del sistema.
- **No:** autenticación en esta spec. Reemplazar `av_user` toca `/auth`, `nav` y `session-provider`, y exige elegir método de login. Va en su propia spec.
- **Sí:** `@supabase/ssr` para ambos clientes. Es el paquete oficial para Next.js con cookies y evita reescribir los helpers cuando llegue la auth.
- **No:** `@supabase/supabase-js` suelto como único cliente. Funcionaría hoy, pero obligaría a cambiar el cliente de servidor en la spec de auth.
- **Sí:** clave publishable. Es la clave actual de Supabase y puede rotarse sin afectar los JWT de usuarios.
- **No:** clave `anon` legacy. Supabase la está reemplazando.
- **Sí:** migraciones como archivos SQL en `supabase/migrations/`, aplicadas con el MCP. Queda el esquema versionado en git y reproducible en otro entorno.
- **No:** cambios de esquema solo por MCP sin archivos. Es más rápido, pero el esquema no queda en el repositorio.
- **Sí:** función `ping()` más `/api/health` como verificación. Prueba variables, cliente de servidor, red y migraciones sin crear tablas de dominio que luego haya que rediseñar.
- **No:** crear `proxy.ts` ahora. Sin sesión no hay nada que refrescar y se interceptarían todas las rutas, incluidas las que usan `cacheComponents`, sin beneficio.
- **Sí:** `/api/health` devuelve un error genérico y registra el detalle en el servidor, igual que el formulario de contacto de la SPEC 03.
- **Sí:** mantener `GAMES`, `seededScores` y `lib/home.ts` como mock. Se migran cuando exista el esquema de juegos y puntajes.
- **No:** Supabase CLI ni entorno local con Docker. Añaden requisitos de instalación sin necesidad para una sola función SQL.
- **No:** `service_role`. No hay ninguna operación que lo requiera; añadirlo sin uso amplía la superficie de fuga.

---

## Riesgos identificados

| Riesgo                                                                          | Mitigación                                                                                                                                                 |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| La publishable key se confunde con un secreto o se sustituye por `service_role` | Criterio de aceptación que prohíbe `service_role` y `anon` legacy; el README aclara que la publishable es pública y la seguridad la dan las políticas RLS. |
| El archivo de migración y lo aplicado en el proyecto divergen                   | Mismo nombre y contenido; `list_migrations` se compara en el paso 3 y en los criterios.                                                                    |
| `ping()` queda expuesta como RPC pública                                        | Solo devuelve una constante, sin acceso a tablas; se revisa con `get_advisors` en el paso 5.                                                               |
| `cookies()` en el cliente de servidor choca con `cacheComponents: true`         | Leer la guía de Next 16 antes de escribir código; `/api/health` es dinámico por naturaleza y no afecta a páginas estáticas.                                |
| Importar el cliente de servidor desde un componente cliente                     | Criterio de aceptación específico; los helpers viven en archivos separados.                                                                                |
| `.env.local` con valores reales se sube a git                                   | `.gitignore` ya ignora `.env*`; solo `.env.example` está excepcionado y no lleva valores.                                                                  |

---

## Lo que **no** está en esta spec

- Autenticación, `proxy.ts` ni manejo de sesión de Supabase.
- Tablas de dominio, RLS de negocio ni migración de datos mock.
- Clave `service_role`, tipos generados, Supabase CLI local, Edge Functions, Storage o Realtime.
- Cambios visuales en cualquier pantalla.

Cada uno, si se aborda, va en su propia spec.
