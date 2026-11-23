import { createHmac, timingSafeEqual } from "node:crypto";

// ---------------------------------------------------------------------------
// Enlaces firmados de los mails: abrir (píxel), clic (redirección) y baja.
//
// Cada enlace lleva el id del envío y una firma HMAC. Sin la firma, cualquiera
// podría dar de baja a otros cambiando un número en la URL, inflar las
// estadísticas, o usar /api/t/c como redirección hacia cualquier sitio
// (open redirect, muy usado en phishing). La clave se deriva de JWT_SECRET
// con otro propósito: una firma de seguimiento nunca sirve como sesión.
// ---------------------------------------------------------------------------

export type LinkKind = "open" | "click" | "unsubscribe";

function key(): Buffer {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('Falta la variable de entorno "JWT_SECRET"');
  return createHmac("sha256", secret).update("cartero/enlaces-de-mail").digest();
}

function signature(kind: LinkKind, deliveryId: string, extra = ""): string {
  return createHmac("sha256", key())
    .update(`${kind}\n${deliveryId}\n${extra}`)
    .digest()
    .subarray(0, 16) // 128 bits: de sobra para que no se pueda adivinar
    .toString("base64url");
}

/** "<id del envío>.<firma>" */
export function signToken(kind: LinkKind, deliveryId: string, extra = ""): string {
  return `${deliveryId}.${signature(kind, deliveryId, extra)}`;
}

/** El id del envío si la firma es buena; null si no. */
export function verifyToken(kind: LinkKind, token: string, extra = ""): string | null {
  const [deliveryId, sig] = token.split(".");
  if (!deliveryId || !sig || !/^[0-9a-f]{24}$/.test(deliveryId)) return null;
  const expected = Buffer.from(signature(kind, deliveryId, extra));
  const given = Buffer.from(sig);
  // Comparación en tiempo constante: no revela cuántos caracteres acertó.
  return given.length === expected.length && timingSafeEqual(given, expected) ? deliveryId : null;
}

export function openUrl(base: string, deliveryId: string): string {
  return `${base}/api/t/o/${signToken("open", deliveryId)}`;
}

export function clickUrl(base: string, deliveryId: string, target: string): string {
  return `${base}/api/t/c/${signToken("click", deliveryId, target)}?u=${encodeURIComponent(target)}`;
}

export function unsubscribeUrl(base: string, deliveryId: string): string {
  return `${base}/baja/${signToken("unsubscribe", deliveryId)}`;
}

const decodeAmp = (url: string) => url.replace(/&amp;/g, "&");

/**
 * Cambia cada enlace http(s) del HTML por uno que pasa por /api/t/c: así se
 * cuenta el clic y se redirige al destino. Los mailto:, los anclas y el
 * enlace de baja quedan como están.
 */
export function trackLinks(html: string, wrap: (target: string) => string, keep: (target: string) => boolean): string {
  return html.replace(/(<a\b[^>]*?\bhref\s*=\s*)(["'])([\s\S]*?)\2/gi, (whole, start: string, quote: string, href: string) => {
    const target = decodeAmp(href.trim());
    if (!/^https?:\/\//i.test(target) || keep(target)) return whole;
    return `${start}${quote}${wrap(target).replace(/&/g, "&amp;")}${quote}`;
  });
}

/** Agrega la imagen de 1×1 que cuenta la apertura, al final del cuerpo. */
export function addPixel(html: string, pixelUrl: string): string {
  const img = `<img src="${pixelUrl}" width="1" height="1" alt="" style="display:block;border:0;width:1px;height:1px">`;
  return /<\/body>/i.test(html) ? html.replace(/<\/body>/i, `${img}</body>`) : html + img;
}
