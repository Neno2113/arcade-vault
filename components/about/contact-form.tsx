"use client";

import { useActionState, useState } from "react";
import { sendContact } from "@/app/acerca/actions";
import {
  CONTACT_LIMITS,
  type ContactFields,
  type ContactState,
} from "@/lib/contact";

const IDLE: ContactState = { status: "idle" };

// Al cambiar `key` se monta un formulario nuevo: es la forma de reiniciar
// useActionState tras "ENVIAR OTRO MENSAJE".
export function ContactForm() {
  const [session, setSession] = useState(0);
  return (
    <ContactFormSession
      key={session}
      onReset={() => setSession((n) => n + 1)}
    />
  );
}

function ContactFormSession({ onReset }: { onReset: () => void }) {
  const [values, setValues] = useState({ name: "", email: "", message: "" });
  const [shake, setShake] = useState(false);

  const [state, formAction, pending] = useActionState(
    async (prev: ContactState, formData: FormData) => {
      const next = await sendContact(prev, formData);
      if (next.status === "error" && next.fieldErrors) {
        setShake(true);
        setTimeout(() => setShake(false), 400);
      }
      return next;
    },
    IDLE,
  );

  const set =
    (key: ContactFields) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setValues((v) => ({ ...v, [key]: e.target.value }));

  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;
  const formError = state.status === "error" ? state.message : undefined;

  return (
    <form
      className={"contact-form" + (shake ? " shake" : "")}
      action={formAction}
      noValidate
    >
      {state.status === "success" ? (
        <div className="terminal-success">
          <div className="term-bar">
            <span className="dot r"></span>
            <span className="dot y"></span>
            <span className="dot g"></span>
            <span className="term-title">VAULT-OS // TERMINAL</span>
          </div>
          <div className="term-body" role="status">
            <div className="line">
              <span className="prompt">vault@arcade:~$</span> ./send_message
              --to=team
            </div>
            <div className="line dim">[OK] Conectando con servidor…</div>
            <div className="line dim">[OK] Validando contenido…</div>
            <div className="line dim">[OK] Transmitiendo paquete…</div>
            <div className="line success">
              &gt; MENSAJE RECIBIDO. TE RESPONDEREMOS PRONTO. GRACIAS,{" "}
              {state.name.toUpperCase()}.<span className="caret">_</span>
            </div>
            <div style={{ marginTop: 18 }}>
              <button className="btn ghost" type="button" onClick={onReset}>
                ENVIAR OTRO MENSAJE
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="field">
            <label htmlFor="contact-name">Nombre</label>
            <input
              id="contact-name"
              name="name"
              value={values.name}
              onChange={set("name")}
              placeholder="px_kai"
              maxLength={CONTACT_LIMITS.name}
              autoComplete="name"
              aria-invalid={fieldErrors?.name ? true : undefined}
              aria-describedby={fieldErrors?.name ? "contact-name-err" : undefined}
            />
            {fieldErrors?.name && (
              <div className="field-error" id="contact-name-err">
                {fieldErrors.name}
              </div>
            )}
          </div>
          <div className="field">
            <label htmlFor="contact-email">Correo electrónico</label>
            <input
              id="contact-email"
              name="email"
              type="email"
              value={values.email}
              onChange={set("email")}
              placeholder="jugador@vault.gg"
              maxLength={CONTACT_LIMITS.email}
              autoComplete="email"
              aria-invalid={fieldErrors?.email ? true : undefined}
              aria-describedby={fieldErrors?.email ? "contact-email-err" : undefined}
            />
            {fieldErrors?.email && (
              <div className="field-error" id="contact-email-err">
                {fieldErrors.email}
              </div>
            )}
          </div>
          <div className="field">
            <label htmlFor="contact-message">Mensaje</label>
            <textarea
              id="contact-message"
              name="message"
              rows={5}
              value={values.message}
              onChange={set("message")}
              placeholder="Cuéntanos qué tienes en mente…"
              maxLength={CONTACT_LIMITS.message}
              aria-invalid={fieldErrors?.message ? true : undefined}
              aria-describedby={
                fieldErrors?.message ? "contact-message-err" : undefined
              }
            />
            {fieldErrors?.message && (
              <div className="field-error" id="contact-message-err">
                {fieldErrors.message}
              </div>
            )}
          </div>

          {/* Honeypot: invisible para personas, tentador para bots. */}
          <div className="hp" aria-hidden="true">
            <label htmlFor="contact-website">Sitio web</label>
            <input
              id="contact-website"
              name="website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
            />
          </div>

          {formError && (
            <div className="form-error" role="alert">
              {formError}
            </div>
          )}

          <button
            className="btn xl press"
            type="submit"
            disabled={pending}
            style={{ width: "100%" }}
          >
            {pending ? "ENVIANDO…" : "▶  ENVIAR MENSAJE"}
          </button>
        </>
      )}
    </form>
  );
}
