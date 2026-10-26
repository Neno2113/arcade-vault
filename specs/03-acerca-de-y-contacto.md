# SPEC 03 — Página "Acerca de" y envío de contacto con Resend

> **Status:** Implementado
> **Depends on:** SPEC 02
> **Date:** 2026-10-25
> **Objective:** Implementar la página `/acerca` portada de `references/templates/home-about/about.jsx`, con un formulario de contacto que envía el mensaje por correo mediante Resend desde una Server Action.

---

## Por qué existe esta spec

La SPEC 02 dejó fuera la página "Acerca de" y su enlace en el nav ("va en otro spec"). La referencia `about.jsx` trae la misión del proyecto, tres destacados y un formulario de contacto que en el prototipo solo simula el envío. Esta spec porta la página y hace real el envío usando Resend, sin base de datos ni cuentas.

---

## Alcance

**Dentro:**

- Nueva ruta `/acerca` portada de `about.jsx`, con estas secciones en orden:
  1. **Hero "Acerca de"**: kicker "▸ ACERCA DE", título "ACERCA DE ARCADE VAULT", texto de misión y 3 destacados con icono pixel (HEART, BROWSER, PLANT).
  2. **Divisor** decorativo de píxeles.
  3. **Contacto**: introducción ("CONTÁCTANOS", 3 indicadores LED) y formulario (nombre, correo, mensaje).
- Animación de aparición al scroll (`reveal`) en el divisor y la sección de contacto, reutilizando `components/home/reveal.tsx`.
- Envío real del formulario con una **Server Action** que valida en servidor y envía el correo con el SDK `resend`.
- Estados del formulario: inicial, enviando, éxito (terminal "VAULT-OS // TERMINAL" con el nombre en mayúsculas, como la referencia), error de validación (animación `shake` + mensajes) y error de envío.
- Protección anti-spam: validación en servidor con límites de longitud y un campo honeypot oculto.
- Correo de texto plano al equipo con `replyTo` igual al correo del visitante.
- Enlace "Acerca de" en el nav (escritorio y panel móvil), con estado activo en `/acerca`.
- Variables de entorno `RESEND_API_KEY`, `CONTACT_FROM` y `CONTACT_TO`, documentadas en un `.env.example` (el `.gitignore` ya ignora `.env*`, así que `.env.example` requiere excepción explícita).
- Añadir a `app/globals.css` solo las reglas nuevas de about/contacto tomadas de `references/templates/home-about/styles.css`.

**Fuera de alcance (specs futuras):**

- Rate limiting por IP (requiere almacenamiento externo).
- Guardar los mensajes en base de datos o mostrarlos en alguna vista.
- Correo de confirmación al visitante (autorespuesta).
- Plantillas HTML de correo / React Email: el correo es texto plano.
- CAPTCHA (Turnstile, reCAPTCHA).
- Enlace "Acerca de" en el footer.
- Internacionalización, tests automatizados y cualquier cambio en las demás pantallas más allá del nav.

---

## Modelo de datos

No se introducen datos persistentes. Solo tipos para el formulario y la acción.

```ts
// lib/contact.ts
export const CONTACT_LIMITS = { name: 60, email: 120, message: 2000 } as const;

export type ContactFields = "name" | "email" | "message";

export type ContactState =
  | { status: "idle" }
  | { status: "success"; name: string }
  | { status: "error"; fieldErrors?: Partial<Record<ContactFields, string>>; message?: string };

export function validateContact(input: {
  name: string;
  email: string;
  message: string;
}): { ok: true; data: { name: string; email: string; message: string } } | { ok: false; fieldErrors: Partial<Record<ContactFields, string>> };
```

```ts
// app/acerca/actions.ts  ("use server")
export async function sendContact(prev: ContactState, formData: FormData): Promise<ContactState>;
```

Variables de entorno (solo servidor, nunca `NEXT_PUBLIC_*`):

| Variable         | Uso                                                                              |
| ---------------- | -------------------------------------------------------------------------------- |
| `RESEND_API_KEY` | Clave de API de Resend.                                                          |
| `CONTACT_FROM`   | Remitente. En desarrollo `Arcade Vault <onboarding@resend.dev>`; en producción un dominio verificado. |
| `CONTACT_TO`     | Correo del equipo que recibe los mensajes.                                       |

Convenciones:

- El campo honeypot se llama `website`; si llega con valor, la acción responde `success` sin enviar nada (no revela el bloqueo al bot).
- Se aplica `trim()` a todos los campos; correo validado con una expresión simple de formato.
- El asunto del correo es `[Arcade Vault] Mensaje de <nombre>`; los saltos de línea del mensaje se conservan.
- Textos de la UI en español, igual que la referencia.
- Si falta alguna variable de entorno, la acción responde `error` con mensaje genérico y registra la causa con `console.error` en servidor; nunca se expone la causa al cliente.

---

## Plan de implementación

Antes de escribir código de Next, leer la guía relevante en `node_modules/next/dist/docs/` (según `AGENTS.md`; en especial Server Actions / formularios y variables de entorno) y usar `/frontend-design` para el trabajo de UI (según `CLAUDE.md`).

1. Instalar `resend` (`npm install resend`), crear `.env.example` con las tres variables (añadir `!.env.example` al `.gitignore`) y `lib/contact.ts` con `CONTACT_LIMITS`, tipos y `validateContact`. Verificar con `npx tsc --noEmit`.
2. Crear `app/acerca/actions.ts` con `sendContact`: honeypot, `validateContact`, comprobación de variables, envío con `new Resend(process.env.RESEND_API_KEY).emails.send({ from, to, replyTo, subject, text })` y manejo del `error` devuelto por Resend. Verificar: sin `RESEND_API_KEY` devuelve `error` genérico sin lanzar excepción.
3. Añadir a `app/globals.css` las reglas de about/contacto que no existan (`about-hero`, `about-title`, `about-mission`, `highlight-row`, `highlight`, `hl-icon`, `about-divider`, `contact-grid`, `contact-form`, `tip`/`tip-led`, `terminal-success`, `term-*`, `shake`, etc.) copiadas de `references/templates/home-about/styles.css`. No modificar reglas existentes; si hay colisión, conservar la existente y anotarlo en el PR. Verificar: `npm run build` y las pantallas existentes se ven igual.
4. Crear `components/about/highlight-icon.tsx` (HEART, BROWSER, PLANT, servidor) y `components/about/contact-form.tsx` (client, `useActionState(sendContact, { status: "idle" })`): campos controlados por `name`, honeypot oculto fuera de pantalla (`aria-hidden`, `tabIndex={-1}`, `autoComplete="off"`), botón deshabilitado y con texto de envío mientras `pending`, `shake` ante `fieldErrors`, terminal de éxito con "ENVIAR OTRO MENSAJE" que reinicia el formulario, y mensaje de error de envío visible.
5. Crear `components/about/about-page.tsx` con hero, divisor y contacto (usando `Reveal`), y `app/acerca/page.tsx` con `metadata.title` en español que lo renderiza. Verificar: `/acerca` se ve igual que la referencia en escritorio y móvil.
6. Actualizar `components/nav.tsx`: añadir `isAbout` (`pathname.startsWith("/acerca")`) y el enlace "Acerca de" en escritorio y panel móvil, después de "Salón de la Fama". Verificar el estado activo.
7. Prueba end-to-end con una clave real de Resend en `.env.local`: enviar un mensaje desde `/acerca` y confirmar recepción en `CONTACT_TO` con `replyTo` correcto. Luego `npm run lint`, `npx tsc --noEmit`, `npm run build`.

---

## Criterios de aceptación

- [x] `npm run build`, `npm run lint` y `npx tsc --noEmit` terminan sin errores.
- [x] `/acerca` carga sin errores en consola ni advertencias de hidratación y muestra hero, 3 destacados, divisor y sección de contacto en ese orden.
- [x] El nav muestra Inicio, Biblioteca, Salón de la Fama y Acerca de (escritorio y panel móvil); "Acerca de" queda activo solo en `/acerca`.
- [x] Enviar el formulario con algún campo vacío no envía correo, ejecuta la animación `shake` y muestra el error junto al campo.
- [x] Un correo con formato inválido, o un campo que supere `CONTACT_LIMITS`, es rechazado por el servidor aunque se salte la validación del navegador.
- [x] Con datos válidos y claves correctas, llega un correo a `CONTACT_TO` con asunto `[Arcade Vault] Mensaje de <nombre>`, cuerpo con nombre, correo y mensaje, y `replyTo` igual al correo del visitante.
- [x] Tras el envío exitoso se muestra la terminal con "MENSAJE RECIBIDO. TE RESPONDEREMOS PRONTO. GRACIAS, <NOMBRE EN MAYÚSCULAS>."; "ENVIAR OTRO MENSAJE" devuelve el formulario vacío.
- [x] Durante el envío el botón está deshabilitado y no permite doble envío.
- [x] Si Resend falla o faltan variables de entorno, el formulario conserva lo escrito y muestra un mensaje de error genérico; el detalle solo aparece en el log del servidor.
- [x] Si el campo honeypot `website` llega con valor, la acción responde éxito y no se envía ningún correo.
- [x] `RESEND_API_KEY`, `CONTACT_FROM` y `CONTACT_TO` no aparecen en el bundle del cliente ni en el HTML servido.
- [x] Existe `.env.example` con las tres variables y sin valores reales; `.env.local` sigue ignorado por git.
- [x] En ancho < 768 px la página y el formulario se ven correctamente sin desbordamiento horizontal.
- [x] Las pantallas `/`, `/biblioteca`, `/juegos/[id]`, `/juegos/[id]/jugar`, `/auth` y `/salon` se ven igual que antes de esta spec, salvo el nuevo enlace del nav.

---

## Decisiones tomadas y descartadas

- **Sí:** Server Action. No expone un endpoint público que mantener, la API key permanece en el servidor y es el patrón natural de Next 16 para formularios.
- **No:** Route Handler `/api/contacto`. Solo se justificaría si otro cliente necesitara consumir el endpoint.
- **Sí:** ruta `/acerca`. Sigue la convención en español del proyecto (`/biblioteca`, `/salon`, `/juegos`).
- **Sí:** variables de entorno para remitente y destinatario. Resend solo entrega desde `onboarding@resend.dev` al correo dueño de la cuenta; pasar a un dominio verificado en producción no debe requerir cambios de código.
- **Sí:** validación en servidor + honeypot. Cubre el spam básico sin dependencias ni servicios adicionales.
- **No:** rate limiting ni CAPTCHA en esta spec. Requieren almacenamiento o servicio externo y abren otro dominio de decisiones; se abordan en una spec propia si hay abuso.
- **Sí:** `replyTo` con el correo del visitante, para responder directamente desde el cliente de correo. El remitente real sigue siendo `CONTACT_FROM`.
- **Sí:** correo de texto plano. Suficiente para un buzón interno; evita sumar React Email.
- **No:** guardar mensajes en base de datos ni autorespuesta al visitante. Fuera del alcance de un formulario de contacto mínimo.
- **Sí:** enlace "Acerca de" solo en el nav, como se confirmó; el footer queda sin cambios.
- **Sí:** añadir a `globals.css` solo las reglas nuevas, igual que en SPEC 02, para no alterar pantallas ya implementadas.
- **Sí:** componentes cliente solo para el formulario; la página, el hero y los iconos son de servidor. `Reveal` se reutiliza de la SPEC 02.
- **Sí:** `useActionState` en lugar de `fetch` manual, para obtener `pending` y el resultado de la acción sin estado adicional.

---

## Riesgos identificados

| Riesgo                                                                                   | Mitigación                                                                                                  |
| ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `onboarding@resend.dev` solo entrega al correo dueño de la cuenta de Resend              | `CONTACT_TO` debe ser ese correo en desarrollo; documentarlo en `.env.example`. En producción, dominio verificado. |
| Fuga de la API key al cliente                                                            | Variables sin prefijo `NEXT_PUBLIC_`; `resend` solo se importa en `app/acerca/actions.ts`; criterio de aceptación específico. |
| Spam que supera el honeypot                                                              | Límites de longitud y validación en servidor; si hay abuso, spec futura con rate limit o CAPTCHA.            |
| Reglas CSS nuevas colisionan con las existentes (`.field`, `.btn`, `.kicker`, `.reveal`) | Conservar las existentes; comparar visualmente las pantallas previas en el paso 3.                          |
| Next 16 difiere de versiones conocidas (Server Actions, `cacheComponents`)               | Leer `node_modules/next/dist/docs/` antes de escribir código; la página `/acerca` es estática y solo la acción es dinámica. |
| Inyección de cabeceras o contenido en el correo                                          | Correo de texto plano; el nombre se usa en el asunto tras eliminar saltos de línea.                         |
| Desajuste de hidratación                                                                 | Sin `Math.random` ni fechas en el render; el formulario no lee `localStorage`.                              |

---

## Lo que **no** está en esta spec

- Rate limiting, CAPTCHA o cualquier otra protección anti-spam más allá de validación y honeypot.
- Persistencia de mensajes, panel de administración o autorespuesta al visitante.
- Plantillas HTML de correo.
- Enlace a "Acerca de" en el footer.
- Cambios de diseño en el resto de pantallas.
- Tests automatizados e internacionalización.

Cada uno, si se aborda, va en su propia spec.
