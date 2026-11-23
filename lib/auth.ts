import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import type { ObjectId } from "mongodb";
import { collections, toObjectId } from "./db";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, signSession, verifySession, type SessionPayload } from "./jwt";
import type { Role } from "./types";

// ---------------------------------------------------------------------------
// Sesión (cookie httpOnly con el JWT), enlaces mágicos y la comprobación de
// organización que hacen todas las rutas de la API.
// ---------------------------------------------------------------------------

export async function getSession(): Promise<SessionPayload | null> {
  const jwt = (await cookies()).get(SESSION_COOKIE)?.value;
  return jwt ? verifySession(jwt) : null;
}

export async function startSession(payload: SessionPayload): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, await signSession(payload), {
    httpOnly: true, // el JavaScript de la página no la puede leer
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax", // no viaja en peticiones POST desde otros sitios
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function endSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

// --- Enlaces mágicos -----------------------------------------------------------

/** Cuánto vale un enlace para entrar. */
export const LOGIN_TOKEN_TTL_MS = 15 * 60 * 1000;
/** Enlaces que se pueden pedir por email en LOGIN_RATE_WINDOW_MS. */
export const LOGIN_RATE_LIMIT = 3;
export const LOGIN_RATE_WINDOW_MS = 10 * 60 * 1000;

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** 32 bytes al azar: imposible de adivinar. En la base solo se guarda el hash. */
export function newToken(): string {
  return randomBytes(32).toString("base64url");
}

// --- Organización de la sesión --------------------------------------------------

export interface TenantCaller {
  userId: ObjectId;
  email: string;
  tenantId: ObjectId;
  role: Role;
}

export class AuthError extends Error {
  constructor(
    public status: 401 | 403,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Quién llama y en qué organización. El tenant sale del JWT, nunca de la
 * petición: un id de organización en la URL o en el cuerpo se ignora. Y se
 * confirma en la base que sigue siendo miembro: si el dueño lo quitó, deja
 * de ver los datos al momento, sin esperar a que caduque la sesión.
 */
export async function requireTenant(minRole: Role = "member"): Promise<TenantCaller> {
  const session = await getSession();
  const userId = toObjectId(session?.sub);
  if (!session || !userId) throw new AuthError(401, "Tenés que iniciar sesión.");
  const tenantId = toObjectId(session.tid);
  if (!tenantId) throw new AuthError(403, "Primero creá o elegí una organización.");
  const { memberships } = await collections();
  const membership = await memberships.findOne({ tenantId, userId });
  if (!membership) throw new AuthError(403, "Ya no sos miembro de esta organización.");
  if (minRole === "owner" && membership.role !== "owner") {
    throw new AuthError(403, "Solo el dueño de la organización puede hacer esto.");
  }
  return { userId, email: session.email, tenantId, role: membership.role };
}

export async function requireUser(): Promise<SessionPayload & { userId: ObjectId }> {
  const session = await getSession();
  const userId = toObjectId(session?.sub);
  if (!session || !userId) throw new AuthError(401, "Tenés que iniciar sesión.");
  return { ...session, userId };
}
