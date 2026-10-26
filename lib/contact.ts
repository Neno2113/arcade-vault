export const CONTACT_LIMITS = { name: 60, email: 120, message: 2000 } as const;

export type ContactFields = "name" | "email" | "message";

export type ContactState =
  | { status: "idle" }
  | { status: "success"; name: string }
  | {
      status: "error";
      fieldErrors?: Partial<Record<ContactFields, string>>;
      message?: string;
    };

type ContactInput = { name: string; email: string; message: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateContact(
  input: ContactInput,
):
  | { ok: true; data: ContactInput }
  | { ok: false; fieldErrors: Partial<Record<ContactFields, string>> } {
  const data = {
    name: input.name.trim(),
    email: input.email.trim(),
    message: input.message.trim(),
  };
  const fieldErrors: Partial<Record<ContactFields, string>> = {};

  if (!data.name) fieldErrors.name = "Escribe tu nombre.";
  else if (data.name.length > CONTACT_LIMITS.name)
    fieldErrors.name = `Máximo ${CONTACT_LIMITS.name} caracteres.`;

  if (!data.email) fieldErrors.email = "Escribe tu correo.";
  else if (data.email.length > CONTACT_LIMITS.email)
    fieldErrors.email = `Máximo ${CONTACT_LIMITS.email} caracteres.`;
  else if (!EMAIL_RE.test(data.email))
    fieldErrors.email = "Correo con formato inválido.";

  if (!data.message) fieldErrors.message = "Escribe un mensaje.";
  else if (data.message.length > CONTACT_LIMITS.message)
    fieldErrors.message = `Máximo ${CONTACT_LIMITS.message} caracteres.`;

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };
  return { ok: true, data };
}
