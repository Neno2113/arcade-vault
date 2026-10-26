"use server";

import { Resend } from "resend";
import { validateContact, type ContactState } from "@/lib/contact";

const GENERIC_ERROR =
  "No pudimos enviar tu mensaje. Inténtalo de nuevo en unos minutos.";

function field(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function sendContact(
  _prev: ContactState,
  formData: FormData,
): Promise<ContactState> {
  // Honeypot: un bot lo rellena; respondemos éxito sin enviar nada.
  if (field(formData, "website")) {
    return { status: "success", name: field(formData, "name").trim() };
  }

  const result = validateContact({
    name: field(formData, "name"),
    email: field(formData, "email"),
    message: field(formData, "message"),
  });
  if (!result.ok) {
    return { status: "error", fieldErrors: result.fieldErrors };
  }
  const { name, email, message } = result.data;

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.CONTACT_FROM;
  const to = process.env.CONTACT_TO;
  if (!apiKey || !from || !to) {
    console.error(
      "[contacto] Faltan variables de entorno:",
      [
        !apiKey && "RESEND_API_KEY",
        !from && "CONTACT_FROM",
        !to && "CONTACT_TO",
      ]
        .filter(Boolean)
        .join(", "),
    );
    return { status: "error", message: GENERIC_ERROR };
  }

  try {
    const { error } = await new Resend(apiKey).emails.send({
      from,
      to,
      replyTo: email,
      subject: `[Arcade Vault] Mensaje de ${name.replace(/[\r\n]+/g, " ")}`,
      text: `Nombre: ${name}\nCorreo: ${email}\n\n${message}`,
    });
    if (error) {
      console.error("[contacto] Resend devolvió un error:", error);
      return { status: "error", message: GENERIC_ERROR };
    }
  } catch (err) {
    console.error("[contacto] Falló el envío:", err);
    return { status: "error", message: GENERIC_ERROR };
  }

  return { status: "success", name };
}
