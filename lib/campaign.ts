import { compile, render, varsFor, type Compiled } from "./handlebars";
import { addPixel, clickUrl, openUrl, trackLinks, unsubscribeUrl } from "./tracking";
import type { CampaignStatus } from "./types";

// ---------------------------------------------------------------------------
// Campañas: estados, a quién se manda y cómo queda cada mail.
//
//   draft ──(enviar ahora)──────────────► sending ──► sent
//     │  ▲                                  ▲
//     │  └──(cancelar programación)──┐      │
//     └──(programar)──────────► scheduled ──┘ (llega la hora)
//
// Una campaña enviada no se vuelve a enviar: para mandar otra vez, se duplica.
// ---------------------------------------------------------------------------

export const STATUS_LABEL: Record<CampaignStatus, string> = {
  draft: "Borrador",
  scheduled: "Programada",
  sending: "Enviando",
  sent: "Enviada",
  cancelled: "Cancelada",
};

/** Solo un borrador se edita. */
export const canEdit = (status: CampaignStatus) => status === "draft";
export const canSend = (status: CampaignStatus) => status === "draft" || status === "scheduled";
export const canSchedule = (status: CampaignStatus) => status === "draft" || status === "scheduled";
export const canUnschedule = (status: CampaignStatus) => status === "scheduled";

/** Cuántos intentos tiene cada mail antes de darlo por fallido. */
export const MAX_ATTEMPTS = 3;

/**
 * Modo demo (la versión publicada): DEMO_ALLOWED_RECIPIENTS es una lista
 * separada por comas de emails o dominios (@ejemplo.com). Si está, las
 * campañas solo salen hacia esos destinatarios; el resto queda "omitido".
 * Así una demo pública no se puede usar para mandar spam.
 */
export function parseAllowlist(value: string | undefined): string[] | null {
  const items = (value ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return items.length > 0 ? items : null;
}

export function isRecipientAllowed(email: string, allowlist: string[] | null): boolean {
  if (!allowlist) return true;
  const address = email.toLowerCase();
  return allowlist.some((item) => (item.startsWith("@") ? address.endsWith(item) : address === item));
}

export interface MessageInput {
  base: string; // dominio público, para los enlaces
  deliveryId: string;
  client: { name: string; email: string };
  organization: string;
}

export interface Message {
  subject: string;
  html: string;
  text: string;
  headers: Record<string, string>;
}

/** Plantilla compilada por campaña: se compila una vez y sirve para todos. */
export function compileSnapshot(snapshot: { subject: string; html: string }): Compiled {
  return compile(snapshot.subject, snapshot.html);
}

/**
 * El mail de un destinatario: la plantilla con sus datos, el enlace de baja
 * (al pie si la plantilla no lo usa), los enlaces con seguimiento de clics
 * y el píxel de apertura.
 */
export function buildMessage(compiled: Compiled, input: MessageInput): Message {
  const unsubscribe = unsubscribeUrl(input.base, input.deliveryId);
  const rendered = render(compiled, varsFor(input.client, input.organization, unsubscribe));
  let html = rendered.html;
  if (!html.includes(unsubscribe)) {
    html += `\n<p style="font:12px/1.5 sans-serif;color:#667085;max-width:560px;margin:32px auto 0">¿No querés recibir más mails de ${escapeHtml(input.organization)}? <a href="${unsubscribe}" style="color:#667085">Darte de baja</a>.</p>`;
  }
  html = trackLinks(
    html,
    (target) => clickUrl(input.base, input.deliveryId, target),
    (target) => target === unsubscribe,
  );
  html = addPixel(html, openUrl(input.base, input.deliveryId));
  return {
    subject: rendered.subject,
    html,
    text: htmlToText(rendered.html) + `\n\nDarte de baja: ${unsubscribe}`,
    headers: {
      // Gmail y otros muestran un botón "Anular suscripción" con esto, y
      // desde 2024 lo exigen a quien manda mails masivos.
      "List-Unsubscribe": `<${unsubscribe}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  };
}

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Versión en texto plano del mail, para los programas que no muestran HTML. */
export function htmlToText(html: string): string {
  return html
    .replace(/<(style|script|head)\b[\s\S]*?<\/\1>/gi, "")
    .replace(/<a\b[^>]*?href=(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi, (_, __, href, label) => `${label} (${href})`)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();
}

/**
 * Qué hacer cuando el servidor de correo no acepta un mail.
 *
 * Los servidores SMTP responden con códigos: 4xx es un problema pasajero
 * (lleno, ocupado, "probá más tarde") y vale reintentar; 5xx es definitivo.
 * Dentro de los 5xx, 550, 551 y 553 dicen que la DIRECCIÓN no existe o no
 * es válida: eso es un rebote, y el cliente deja de recibir campañas. Un
 * error de conexión (servidor caído) se reintenta; uno de autenticación
 * (usuario o clave del SMTP mal) es definitivo, pero es culpa de la
 * configuración, no del destinatario.
 */
export interface SendFailure {
  permanent: boolean;
  bounce: boolean;
  reason: string;
}

const BOUNCE_CODES = new Set([550, 551, 553]);

export function classifySendError(error: unknown): SendFailure {
  const err = (typeof error === "object" && error !== null ? error : {}) as {
    responseCode?: number;
    code?: string;
    response?: string;
    message?: string;
  };
  const detail = (err.response || err.message || String(error)).replace(/\s+/g, " ").trim().slice(0, 240);
  const code = err.responseCode;
  if (typeof code === "number" && code >= 500) {
    const bounce = BOUNCE_CODES.has(code);
    return {
      permanent: true,
      bounce,
      reason: bounce ? `La dirección no existe o fue rechazada (${detail})` : `El servidor rechazó el mail (${detail})`,
    };
  }
  if (err.code === "EAUTH") {
    return { permanent: true, bounce: false, reason: `El servidor de correo no aceptó el usuario o la clave (${detail})` };
  }
  return { permanent: false, bounce: false, reason: detail };
}

/** Porcentaje entero de `part` sobre `total` (0 si no hay total). */
export function rate(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}
