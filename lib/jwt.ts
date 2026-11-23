import { SignJWT, jwtVerify } from "jose";

// JWT de sesión (HS256, JWT_SECRET). Sin base de datos: lo usa proxy.ts.
// Lleva la organización activa (tid): toda consulta de datos filtra por ella.

export const SESSION_COOKIE = "session";
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

export interface SessionPayload {
  sub: string; // id del usuario
  email: string;
  tid: string | null; // organización activa; null hasta crear o aceptar una
}

export function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('Falta la variable de entorno "JWT_SECRET"');
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ email: payload.email, tid: payload.tid })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecret());
}

export async function verifySession(jwt: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(jwt, getSecret(), { algorithms: ["HS256"] });
    const { sub, email, tid } = payload;
    if (typeof sub !== "string" || typeof email !== "string") return null;
    if (tid !== null && typeof tid !== "string") return null;
    return { sub, email, tid };
  } catch {
    return null;
  }
}
