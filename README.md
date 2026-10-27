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

### Migraciones

El esquema vive en `supabase/migrations/`, un archivo SQL por cambio, nombrado `YYYYMMDDHHMMSS_descripcion.sql`.

1. Aplica el cambio al proyecto con el MCP de Supabase (`apply_migration`).
2. Consulta `list_migrations` y guarda el SQL en `supabase/migrations/` con la versión que devuelve, para que el archivo y el proyecto coincidan.
3. Ejecuta `get_advisors` (security) y corrige los hallazgos nuevos antes de hacer commit.
4. No edites una migración ya aplicada: añade otra.
