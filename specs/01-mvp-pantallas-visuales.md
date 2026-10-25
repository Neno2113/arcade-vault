# SPEC 01 — MVP visual de Arcade Vault

> **Status:** Implementado
> **Depends on:** Ninguna (el tema CSS y las fuentes ya existen en `app/globals.css` y `app/layout.tsx`)
> **Date:** 2026-10-25
> **Objective:** Portar las 5 pantallas del prototipo `references/templates/` (Biblioteca, Detalle, Reproductor, Auth, Salón de la Fama) a rutas reales de Next.js App Router, solo la parte visual y sin ningún juego real.

---

## Por qué existe esta spec

El prototipo en `references/templates/` es HTML + React UMD + Babel con scripts globales y un router por hash. No puede vivir dentro de Next tal cual. Esta spec lo convierte en módulos ES/TSX y rutas reales, conservando el diseño y el comportamiento simulado. La persistencia real y los juegos quedan para specs posteriores.

> Nota: `CLAUDE.md` menciona `resources/templates/`, pero la carpeta real es `references/templates/`. Esta spec usa la ruta real.

---

## Alcance

**Dentro:**

- Rutas reales de App Router:
  - `/` → Biblioteca (hero, búsqueda por nombre, chips de categoría, grilla de tarjetas con efecto tilt).
  - `/juegos/[id]` → Detalle (portada, tags, estadísticas, tabla de mejores puntuaciones, botón jugar).
  - `/juegos/[id]/jugar` → Reproductor simulado.
  - `/auth` → Iniciar sesión / Crear cuenta / Jugar como invitado.
  - `/salon` → Salón de la Fama (tabs por juego, podio, tabla, fila "tu mejor marca").
- `Nav` (con menú móvil y contador de créditos decorativo) y footer compartidos desde `app/layout.tsx`.
- Reproductor con el simulacro completo del prototipo: HUD, marco CRT con arena decorativa, puntaje que sube solo, pausa, botón FIN, modal de fin de juego y guardado de puntuación.
- Sesión simulada y puntuaciones guardadas en `localStorage` (claves del prototipo: `av_user`, `av_scores`).
- Datos mock de juegos y puntuaciones semilla portados a módulos TypeScript.
- Reutilizar `app/globals.css` existente (ya contiene el sistema visual del prototipo, ~970 líneas).
- Estado 404 para `id` de juego inexistente.

**Fuera de alcance (specs futuras):**

- Cualquier juego jugable (lógica, canvas, input de teclado/táctil).
- Autenticación real, OAuth con Google/GitHub (los botones son decorativos), backend y base de datos.
- Leaderboards reales: el Salón de la Fama y el detalle siguen usando puntuaciones semilla.
- Integrar en el Salón/Detalle las puntuaciones guardadas en `av_scores`.
- Tests automatizados (no hay runner configurado).
- Internacionalización (la UI es solo en español).

---

## Modelo de datos

```ts
// lib/types.ts
export type Category = "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";
export type GameColor = "cyan" | "magenta" | "yellow" | "green";

export type Game = {
  id: string;        // slug de ruta, ej. "bloque-buster"
  title: string;
  short: string;
  long: string;
  cat: Category;
  cover: string;     // clase CSS de portada, ej. "cover-bricks"
  color: GameColor;
  best: number;
  plays: string;     // texto ya formateado, ej. "12.4K"
};

export type ScoreRow = { rank: number; name: string; score: number; date: string }; // date: "DD/MM/2026"

export type SessionUser = { name: string };            // localStorage "av_user"; null = invitado
export type SavedScore = { game: string; score: number; name: string; at: number }; // localStorage "av_scores" (array)
```

Módulos de datos:

- `lib/games.ts`: `GAMES` (los 8 juegos de `data.jsx`) y `CATS = ["TODOS", ...]`.
- `lib/scores.ts`: `seededScores(seed, count)` determinista (mismo algoritmo del prototipo) para evitar diferencias servidor/cliente.

Convenciones:

- Números con `toLocaleString("es-ES")`.
- Nombres de jugador en mayúsculas, máximo 10 caracteres.
- Rutas con `LayoutProps`/`PageProps` globales de Next, alias `@/*`.

---

## Plan de implementación

Antes de escribir código de Next, leer la guía relevante en `node_modules/next/dist/docs/` (según `AGENTS.md`) y usar `/frontend-design` para el trabajo de UI (según `CLAUDE.md`).

1. Crear `lib/types.ts`, `lib/games.ts` y `lib/scores.ts` portando `data.jsx`. Verificar con `npx tsc --noEmit`.
2. Crear `components/session-provider.tsx` (client): contexto con `user`, `login`, `logout`, `saveScore`, leyendo/escribiendo `av_user` y `av_scores` con `try/catch`. Evitar desajuste de hidratación: el usuario se lee tras montar.
3. Crear `components/nav.tsx` (client, `Link` + `usePathname` para el estado activo, menú móvil) y `components/footer.tsx`. Integrarlos en `app/layout.tsx` dentro de `av-root` con `<main className="av-main">`. Verificar: nav y footer visibles en `/`.
4. Reemplazar `app/page.tsx` por la Biblioteca: `components/library.tsx` (client, búsqueda + chips) y `components/game-card.tsx` (client, tilt). Cada tarjeta enlaza a `/juegos/[id]`. Verificar filtros y estado "NO HAY RESULTADOS".
5. Crear `app/juegos/[id]/page.tsx` (Detalle) con `notFound()` si el `id` no existe y `generateStaticParams` sobre `GAMES` (requerido por `cacheComponents`). Botones a `/juegos/[id]/jugar` y `/`.
6. Crear `app/salon/page.tsx` con `components/hall-of-fame.tsx` (client: tabs, podio, tabla, fila "tu mejor marca" solo con usuario).
7. Crear `app/auth/page.tsx` con `components/auth-form.tsx` (client): tabs entrar/crear, login simulado, "jugar como invitado", botones sociales decorativos. Al enviar redirige a `/`.
8. Crear `app/juegos/[id]/jugar/page.tsx` con `components/game-player.tsx` (client): HUD, CRT, ticker de puntaje, pausa, FIN, modal, guardar, reiniciar, salir a `/juegos/[id]`.
9. Revisión visual contra `references/templates/Arcade Vault.html` en escritorio y móvil, y `npm run lint`, `npx tsc --noEmit`, `npm run build`.

---

## Criterios de aceptación

- [x] `npm run build`, `npm run lint` y `npx tsc --noEmit` terminan sin errores.
- [x] Existen las rutas `/`, `/juegos/[id]`, `/juegos/[id]/jugar`, `/auth` y `/salon`, y todas cargan sin errores en consola ni advertencias de hidratación.
- [x] `/` muestra 8 tarjetas; buscar "caí" deja solo CAÍDA; el chip SHOOTER deja INVASORES y ROCAS; una búsqueda sin coincidencias muestra "NO HAY RESULTADOS".
- [x] Clic en una tarjeta o en su botón JUGAR navega a `/juegos/<id>`.
- [x] `/juegos/inexistente` muestra la página 404 de Next.
- [x] El detalle muestra portada, 4 tags, partidas, mejor global, dificultad y 10 filas de puntuaciones; las 3 primeras tienen estilo top1/top2/top3.
- [x] "▶ JUGAR AHORA" lleva a `/juegos/<id>/jugar` y "VOLVER AL VAULT" a `/`.
- [x] En el reproductor el puntaje aumenta solo; PAUSA lo detiene y muestra "EN PAUSA"; REANUDAR lo retoma; SALIR vuelve al detalle.
- [x] FIN abre el modal con la puntuación final; GUARDAR PUNTUACIÓN añade una entrada a `localStorage["av_scores"]` y muestra "PUNTUACIÓN GUARDADA_"; JUGAR DE NUEVO reinicia en 0; VOLVER AL VAULT lleva a `/`.
- [x] El campo de nombre del modal convierte a mayúsculas y limita a 10 caracteres.
- [x] Iniciar sesión con usuario "kai" guarda `{"name":"KAI"}` en `av_user`, redirige a `/` y el nav muestra "KAI ▾"; recargar mantiene la sesión; clicar el botón la cierra.
- [x] "JUGAR COMO INVITADO" redirige a `/` sin sesión y el reproductor usa el nombre "INVITADO".
- [x] La pestaña "CREAR CUENTA" muestra el campo de correo.
- [x] `/salon` muestra una pestaña por juego, podio y 12 filas; cambiar de pestaña cambia los datos; la fila "TU MEJOR MARCA" aparece solo con sesión iniciada.
- [x] El link activo del nav se resalta en `/`, `/juegos/*` (Biblioteca) y `/salon`.
- [x] En ancho < 768 px aparece el botón ≡ y el panel móvil abre y cierra con su backdrop.
- [x] Con `localStorage` bloqueado la app sigue renderizando sin lanzar errores.

---

## Decisiones tomadas y descartadas

- **Sí:** rutas reales de App Router. Es el patrón de Next y lo indica `CLAUDE.md`; permite enlaces compartibles y `notFound()`.
- **No:** mantener el router por hash. Va contra el framework y rompe SSR y prefetch.
- **Sí:** `/juegos/[id]` y `/juegos/[id]/jugar` como rutas anidadas. La jerarquía refleja el flujo Biblioteca → Detalle → Jugar.
- **Sí:** `localStorage` con las claves del prototipo (`av_user`, `av_scores`). Mantiene el comportamiento visual sin backend; se reemplazará en una spec futura.
- **No:** solo estado en memoria o todo estático. Se perdería el Salón con sesión y el nav logueado.
- **Sí:** reutilizar el `app/globals.css` existente. Ya contiene el tema y garantiza fidelidad visual.
- **No:** reescribir con utilidades Tailwind. Más trabajo y riesgo de divergir del diseño.
- **Sí:** conservar el simulacro completo del reproductor (puntaje, pausa, modal, guardar). Deja el flujo de punta a punta listo para enchufar un juego real.
- **Sí:** puntuaciones semilla deterministas en detalle y Salón; lo guardado en `av_scores` no se muestra todavía.
- **Sí:** componentes cliente solo donde hay estado o eventos (nav, filtros, tarjetas, auth, reproductor, salón); las páginas de detalle y rutas permanecen en servidor.

---

## Riesgos identificados

| Riesgo                                                                 | Mitigación                                                                                 |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Desajuste de hidratación al leer `localStorage` (sesión)               | Leer `av_user` tras montar; el nav renderiza "Iniciar Sesión" hasta entonces.              |
| `cacheComponents: true` rechaza rutas dinámicas sin datos en el prerender | `generateStaticParams` en `/juegos/[id]` y `/juegos/[id]/jugar`; envolver en `Suspense` si hace falta. |
| Next 16 difiere de versiones conocidas (props de ruta, APIs)           | Leer `node_modules/next/dist/docs/` antes de escribir código de Next.                      |
| `localStorage` deshabilitado o con JSON corrupto                       | `try/catch` en toda lectura/escritura; fallback a invitado y a lista vacía.                |
| `Math.random` del ticker rompe la hidratación                          | Solo se usa dentro de `useEffect`/intervalos, nunca durante el render.                     |
| Estado `saved`/`over` del modal se desincroniza al reiniciar           | `restart` reinicia todos los estados, igual que el prototipo.                              |

---

## Lo que **no** está en esta spec

- Ningún juego jugable ni captura de teclado o gestos táctiles.
- Login real, OAuth, backend o base de datos.
- Ranking global real ni mostrar `av_scores` en Salón/Detalle.
- Tests automatizados.
- Internacionalización.

Cada uno, si se aborda, va en su propia spec.
