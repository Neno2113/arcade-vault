# SPEC 02 — Rediseño del home (landing)

> **Status:** Implementado
> **Depends on:** SPEC 01
> **Date:** 2026-10-25
> **Objective:** Reemplazar el home actual (la Biblioteca en `/`) por la landing de `references/templates/home-about/` y mover la Biblioteca a `/biblioteca`, sin incluir la página "Acerca de".

---

## Por qué existe esta spec

La referencia `references/templates/home-about/` trae un home nuevo (landing con hero, secciones y CTA) y una página "Acerca de". El home ocupa la ruta `/`, que hoy sirve la Biblioteca (SPEC 01). Por eso esta spec también reubica la Biblioteca y actualiza los enlaces que apuntaban a `/` esperando la lista de juegos. "Acerca de" va en otro spec.

---

## Alcance

**Dentro:**

- Nueva landing en `/` portada de `home.jsx`, con estas secciones en orden:
  1. **Hero**: eyebrow "INSERTA UNA MONEDA_", título en 3 líneas, subtítulo, CTAs "EXPLORAR JUEGOS" (a `/biblioteca`) y "CREAR CUENTA" (a `/auth`), indicador "DESLIZA", y 8 siluetas pixel flotantes decorativas.
  2. **¿Por qué Arcade Vault?** (`// 01`): 4 tarjetas con icono pixel (GAMEPAD, FREE, TROPHY, ROCKET).
  3. **Juegos disponibles ahora** (`// 02`): carrusel de 6 mini-tarjetas tomadas de `GAMES` (cada una enlaza a `/juegos/[id]`) y botón "VER TODOS LOS JUEGOS →" a `/biblioteca`.
  4. **Stats**: 3 bloques ("12+ JUEGOS", "MILES DE PARTIDAS", "GLOBAL RANKING").
  5. **Actividad en vivo** (`// 03`): "Últimas puntuaciones" (7 filas) y "Top jugadores · hoy" (5 filas, enlace "VER SALÓN →" a `/salon`).
  6. **Precios** (`// 04`): tarjeta "Jugador Vault $0" con botón "EMPEZAR GRATIS →" a `/auth`, y 3 preguntas frecuentes.
  7. **CTA final**: "¿LISTO PARA JUGAR?" con botón "INSERTAR MONEDA →" a `/biblioteca`.
- Animación de aparición al hacer scroll (`reveal` + `IntersectionObserver`) en las secciones 2 a 7.
- Mover la Biblioteca de `/` a `/biblioteca` (sin cambios en `components/library.tsx`).
- Nav (escritorio y panel móvil) con tres enlaces: **Inicio** (`/`), **Biblioteca** (`/biblioteca`) y **Salón de la Fama** (`/salon`). El logo enlaza a `/`.
- Actualizar los enlaces que usaban `/` para volver a la Biblioteca: `app/juegos/[id]/page.tsx`, `components/game-player.tsx`, `components/hall-of-fame.tsx` y las redirecciones de `components/auth-form.tsx`.
- Añadir a `app/globals.css` solo las reglas nuevas del home tomadas de `references/templates/home-about/styles.css`.
- Datos mock estáticos del home en un módulo de `lib/`.

**Fuera de alcance (specs futuras):**

- Página "Acerca de" y su enlace en el nav (otro spec).
- Datos reales en el home: actividad, top, stats y conteos salen de mock estático, no de `av_scores` ni de backend.
- Reemplazo completo de `globals.css` por el `styles.css` de la referencia.
- Cualquier cambio en Detalle, Reproductor, Auth o Salón más allá de actualizar enlaces.
- Juegos jugables, autenticación real, tests automatizados e internacionalización (igual que en SPEC 01).

---

## Modelo de datos

Estructuras nuevas, solo para el contenido estático del home. Los juegos del carrusel reutilizan `Game` y `GAMES` del SPEC 01.

```ts
// lib/home.ts
import type { GameColor } from "@/lib/types";

export type FeatureIconKind = "GAMEPAD" | "FREE" | "TROPHY" | "ROCKET";

export type Feature = { icon: FeatureIconKind; title: string; desc: string; color: GameColor };
export type HomeStat = { n: string; unit: string; sub: string };
export type RecentScore = { player: string; game: string; score: number; ago: string; color: GameColor };
export type TopPlayer = { rank: number; player: string; score: number };
export type FaqItem = { q: string; a: string };

export const FEATURES: Feature[];       // 4 ítems
export const HOME_STATS: HomeStat[];    // 3 ítems
export const RECENT_SCORES: RecentScore[]; // 7 ítems
export const TOP_PLAYERS: TopPlayer[];  // 5 ítems
export const FAQ: FaqItem[];            // 3 ítems
export const PRICING_PERKS: string[];   // 6 ítems
```

Convenciones:

- Textos tal cual la referencia (en español, en mayúsculas donde ella lo hace).
- Números con `toLocaleString("es-ES")`, igual que en SPEC 01.
- Los nombres de juego de `RECENT_SCORES` son texto fijo; no se enlazan a `GAMES`.
- Sin `Math.random` ni fechas dinámicas en el render: el contenido es determinista para evitar desajustes de hidratación.

---

## Plan de implementación

Antes de escribir código de Next, leer la guía relevante en `node_modules/next/dist/docs/` (según `AGENTS.md`) y usar `/frontend-design` para el trabajo de UI (según `CLAUDE.md`).

1. Crear `lib/home.ts` con los tipos y datos de arriba, portados de `home.jsx`. Verificar con `npx tsc --noEmit`.
2. Mover la Biblioteca: crear `app/biblioteca/page.tsx` que renderice `<Library />` y actualizar en `components/nav.tsx` el enlace "Biblioteca" a `/biblioteca`, con `isLibrary` basado en `/biblioteca` y `/juegos*`. Dejar `/` provisionalmente sin cambios. Verificar: `/biblioteca` muestra las 8 tarjetas y el nav resalta "Biblioteca".
3. Añadir a `app/globals.css` las reglas del home que no existen (hero, siluetas, feature-grid, mini-rail, stats, activity, pricing, final, `reveal`) copiadas de `references/templates/home-about/styles.css`. No modificar reglas existentes; si una regla de la referencia colisiona con una existente, conservar la existente y anotarlo en el PR. Verificar: `npm run build` y las 5 pantallas del SPEC 01 se ven igual.
4. Crear `components/home/silhouettes.tsx`, `components/home/feature-icon.tsx` y `components/home/reveal.tsx` (client, `IntersectionObserver` que añade la clase `in`; si no hay soporte o se prefiere menos movimiento, las secciones se muestran visibles). Verificar con un uso temporal en `/`.
5. Crear `components/home/mini-card.tsx` y `components/home/home-page.tsx` con las 7 secciones, usando `Link` en lugar de `navigate`. Reemplazar `app/page.tsx` para que renderice la landing. Verificar: `/` muestra la landing completa y todos los CTA navegan correctamente.
6. Actualizar nav: agregar "Inicio" (`/`) con estado activo solo en `/`, el logo a `/`, y reflejarlo en el panel móvil. No incluir "Acerca de".
7. Actualizar los enlaces de vuelta a la Biblioteca (`app/juegos/[id]/page.tsx`, `components/game-player.tsx`, `components/hall-of-fame.tsx`, `components/auth-form.tsx`) a `/biblioteca`.
8. Revisión visual contra `references/templates/home-about/arcade-vault-standalone.html` en escritorio y móvil, y `npm run lint`, `npx tsc --noEmit`, `npm run build`.

---

## Criterios de aceptación

- [x] `npm run build`, `npm run lint` y `npx tsc --noEmit` terminan sin errores.
- [x] `/` muestra la landing con las 7 secciones en el orden indicado y sin errores en consola ni advertencias de hidratación.
- [x] `/` ya no muestra el buscador ni la grilla de la Biblioteca.
- [x] `/biblioteca` muestra las 8 tarjetas; buscar "caí" deja solo CAÍDA; el chip SHOOTER deja INVASORES y ROCAS.
- [x] El hero muestra 8 siluetas decorativas y el texto "EL ARCADE / CLÁSICO ESTÁ / DE VUELTA".
- [x] "EXPLORAR JUEGOS", "VER TODOS LOS JUEGOS →" e "INSERTAR MONEDA →" llevan a `/biblioteca`.
- [x] "CREAR CUENTA" y "EMPEZAR GRATIS →" llevan a `/auth`.
- [x] La sección de juegos muestra 6 mini-tarjetas y cada una lleva a `/juegos/<id>` de su juego.
- [x] "VER SALÓN →" lleva a `/salon`.
- [x] La sección "Por qué" muestra 4 tarjetas, "Actividad" 7 + 5 filas, "Precios" 6 beneficios y 3 preguntas.
- [x] Las secciones 2 a 7 aparecen con la animación `reveal` al entrar en pantalla.
- [x] El nav muestra exactamente Inicio, Biblioteca y Salón de la Fama, y no contiene ningún enlace "Acerca de" ni a `/acerca`.
- [x] "Inicio" queda activo solo en `/`; "Biblioteca" queda activo en `/biblioteca` y `/juegos/*`; "Salón de la Fama" en `/salon`.
- [x] El logo del nav lleva a `/`.
- [x] "VOLVER AL VAULT" (Detalle, Reproductor) y el botón de volver del Salón llevan a `/biblioteca`.
- [x] Iniciar sesión o "JUGAR COMO INVITADO" redirige a `/biblioteca`.
- [x] En ancho < 768 px el panel móvil abre y cierra, y lista Inicio, Biblioteca y Salón de la Fama.
- [x] Las pantallas `/juegos/[id]`, `/juegos/[id]/jugar`, `/auth` y `/salon` se ven igual que antes de esta spec.

---

## Decisiones tomadas y descartadas

- **Sí:** mover la Biblioteca a `/biblioteca`. Coincide con el nav de la referencia (Inicio / Biblioteca) y libera `/` para la landing.
- **No:** `/juegos` como ruta de la lista. Se aparta del nombre usado en la referencia.
- **Sí:** añadir a `globals.css` solo las reglas nuevas. Evita alterar las 5 pantallas ya implementadas.
- **No:** reemplazar `globals.css` por el `styles.css` de la referencia (1744 líneas). Riesgo de regresiones visuales en lo ya hecho.
- **Sí:** datos mock estáticos en `lib/home.ts`. Es coherente con el SPEC 01, que usa datos semilla y dejó `av_scores` fuera de Salón y Detalle.
- **No:** derivar actividad y top de `av_scores`. Añade lógica cliente y estados vacíos que no pertenecen a un rediseño visual.
- **Sí:** nav sin "Acerca de". Evita un enlace roto hasta que exista el otro spec, que lo añadirá junto con su ruta.
- **Sí:** mantener la sección Precios con el plan único gratuito y su FAQ. Se conserva la referencia completa salvo lo excluido.
- **Sí:** las redirecciones tras login/invitado y los "volver al vault" pasan a `/biblioteca`. Conserva el comportamiento actual (aterrizar en la lista de juegos). Si se prefiere aterrizar en la landing, es un cambio de una línea por enlace.
- **Sí:** el carrusel usa los 6 primeros de `GAMES`, como la referencia. Garantiza que cada mini-tarjeta apunte a un `id` válido.
- **Sí:** componentes cliente solo donde hay estado o efectos (`reveal`); la landing, siluetas e iconos pueden ser de servidor.

---

## Riesgos identificados

| Riesgo                                                                          | Mitigación                                                                                   |
| ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Reglas CSS nuevas colisionan con las existentes (`.btn`, `.section-title`, etc.) | Conservar las existentes; comparar visualmente las 5 pantallas del SPEC 01 en el paso 3.     |
| Secciones con `reveal` quedan invisibles si falla el `IntersectionObserver`      | Mostrarlas visibles por defecto cuando no hay soporte o JS aún no hidrató.                   |
| Enlaces a `/` que esperaban la Biblioteca se pasan por alto                      | Lista cerrada de archivos en el paso 7 y criterios de aceptación específicos por enlace.     |
| `cacheComponents: true` con la nueva ruta                                        | Ambas rutas son estáticas; leer la guía de Next 16 antes de escribir código.                 |
| Desajuste de hidratación                                                         | Datos deterministas, sin `Math.random` ni fechas en el render.                               |

---

## Lo que **no** está en esta spec

- La página "Acerca de" ni su enlace en el nav.
- Datos reales (actividad, top, stats) ni conexión con `av_scores`.
- Reemplazo total de `globals.css`.
- Cambios de diseño en Detalle, Reproductor, Auth o Salón.
- Juegos jugables, login real, backend, tests e internacionalización.

Cada uno, si se aborda, va en su propia spec.
