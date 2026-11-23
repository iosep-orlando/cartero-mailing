// ---------------------------------------------------------------------------
// Validación de lo que llega del navegador (y del CSV de importación).
// ---------------------------------------------------------------------------

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };
const ok = <T>(value: T): Result<T> => ({ ok: true, value });
const fail = <T>(error: string): Result<T> => ({ ok: false, error });

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

// Lo justo para cazar errores de tipeo.
const EMAIL_RE = /^[^\s@<>(),;:"]+@[^\s@<>(),;:"]+\.[^\s@<>(),;:"]+$/;

export function normalizeEmail(value: unknown): string {
  return text(value).toLowerCase();
}

export function validateEmail(value: unknown): Result<string> {
  const email = normalizeEmail(value);
  if (!EMAIL_RE.test(email) || email.length > 254) return fail("Ese email no parece válido.");
  return ok(email);
}

export const MAX_TAGS = 20;

/**
 * Etiquetas: "vip, Mayorista; norte" → ["vip", "mayorista", "norte"].
 * Coma o punto y coma, en minúsculas, sin repetir. Acepta texto o lista.
 */
export function parseTags(value: unknown): Result<string[]> {
  const raw = Array.isArray(value) ? value.filter((t) => typeof t === "string").join(",") : text(value);
  const tags = [
    ...new Set(
      raw
        .split(/[,;]/)
        .map((tag) => tag.trim().toLowerCase().replace(/\s+/g, "-"))
        .filter(Boolean),
    ),
  ];
  if (tags.length > MAX_TAGS) return fail(`Hasta ${MAX_TAGS} etiquetas.`);
  if (tags.some((tag) => tag.length > 30)) return fail("Cada etiqueta puede tener hasta 30 caracteres.");
  return ok(tags);
}

export interface ClientInput {
  email: string;
  name: string;
  tags: string[];
}

export function validateClient(body: Record<string, unknown>): Result<ClientInput> {
  const email = validateEmail(body.email);
  if (!email.ok) return email;
  const name = text(body.name);
  if (name.length > 120) return fail("El nombre puede tener hasta 120 caracteres.");
  const tags = parseTags(body.tags ?? "");
  if (!tags.ok) return tags;
  return ok({ email: email.value, name, tags: tags.value });
}

export interface TemplateInput {
  name: string;
  subject: string;
  html: string;
}

export const MAX_HTML_LENGTH = 200_000;

export function validateTemplateFields(body: Record<string, unknown>): Result<TemplateInput> {
  const name = text(body.name);
  const subject = text(body.subject);
  const html = typeof body.html === "string" ? body.html : "";
  if (!name) return fail("La plantilla necesita un nombre.");
  if (name.length > 80) return fail("El nombre puede tener hasta 80 caracteres.");
  if (!subject) return fail("Escribí el asunto del mail.");
  if (subject.length > 200) return fail("El asunto puede tener hasta 200 caracteres.");
  if (!html.trim()) return fail("Escribí el contenido del mail.");
  if (html.length > MAX_HTML_LENGTH) return fail("El contenido es demasiado largo (hasta 200.000 caracteres).");
  return ok({ name, subject, html });
}

export interface CampaignInput {
  name: string;
  templateId: string;
  tags: string[];
  attachmentIds: string[];
}

const OBJECT_ID_RE = /^[0-9a-f]{24}$/;

export function validateCampaign(body: Record<string, unknown>): Result<CampaignInput> {
  const name = text(body.name);
  if (!name) return fail("La campaña necesita un nombre.");
  if (name.length > 120) return fail("El nombre puede tener hasta 120 caracteres.");
  const templateId = text(body.templateId);
  if (!OBJECT_ID_RE.test(templateId)) return fail("Elegí una plantilla.");
  const tags = parseTags(body.tags ?? "");
  if (!tags.ok) return tags;
  const ids = Array.isArray(body.attachmentIds) ? body.attachmentIds : [];
  if (!ids.every((id) => typeof id === "string" && OBJECT_ID_RE.test(id))) return fail("Adjuntos inválidos.");
  if (ids.length > 5) return fail("Hasta 5 adjuntos por campaña.");
  return ok({ name, templateId, tags: tags.value, attachmentIds: [...new Set(ids as string[])] });
}

/** Una campaña se programa entre dentro de un minuto y dentro de un año. */
export function validateSchedule(value: unknown, now = new Date()): Result<Date> {
  const date = typeof value === "string" ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return fail("Fecha y hora inválidas.");
  if (date.getTime() < now.getTime() + 60_000) return fail("Elegí una fecha y hora futuras.");
  if (date.getTime() > now.getTime() + 366 * 24 * 60 * 60 * 1000) return fail("Hasta un año de anticipación.");
  return ok(date);
}

export function validateOrgName(value: unknown): Result<string> {
  const name = text(value);
  if (!name) return fail("Escribí el nombre de la organización.");
  if (name.length > 80) return fail("El nombre puede tener hasta 80 caracteres.");
  return ok(name);
}
