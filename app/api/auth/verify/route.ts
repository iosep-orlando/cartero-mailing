import { hashToken, startSession } from "@/lib/auth";
import { ApiError, handle, readJson } from "@/lib/api";
import { collections } from "@/lib/db";

// Canjear el enlace por una sesión. Es un POST que dispara el botón "Entrar"
// de /auth/verify, no el simple hecho de abrir el enlace: los antivirus de
// correo abren los enlaces de los mails para revisarlos, y si eso bastara,
// gastarían el enlace antes que la persona.
export const POST = handle(async (request: Request) => {
  const body = await readJson(request);
  const token = typeof body.token === "string" ? body.token : "";
  if (!token) throw new ApiError(400, "Falta el enlace.");

  const { loginTokens, users, invitations, memberships } = await collections();
  const now = new Date();
  // Atómico: un enlace sirve una sola vez, aunque se use en dos pestañas a la vez.
  const login = await loginTokens.findOneAndUpdate(
    { tokenHash: hashToken(token), usedAt: null, expiresAt: { $gt: now } },
    { $set: { usedAt: now } },
  );
  if (!login) throw new ApiError(400, "Este enlace ya no vale: se usó o pasaron más de 15 minutos. Pedí otro.");

  const user = await users.findOneAndUpdate(
    { email: login.email },
    { $setOnInsert: { email: login.email, name: login.email.split("@")[0], createdAt: now } },
    { upsert: true, returnDocument: "after" },
  );
  const userId = user!._id;

  // Invitaciones pendientes para este email: se vuelve miembro.
  const pending = await invitations.find({ email: login.email }).toArray();
  for (const invitation of pending) {
    await memberships.updateOne(
      { tenantId: invitation.tenantId, userId },
      { $setOnInsert: { tenantId: invitation.tenantId, userId, role: "member", createdAt: now } },
      { upsert: true },
    );
  }
  if (pending.length > 0) await invitations.deleteMany({ email: login.email });

  // La organización activa: la última a la que entró (o fue invitado).
  const membership = await memberships.find({ userId }).sort({ createdAt: -1 }).limit(1).next();
  const tid = membership?.tenantId.toString() ?? null;
  await startSession({ sub: userId.toString(), email: login.email, tid });
  return Response.json({ next: tid ? "/dashboard" : "/onboarding" });
});
