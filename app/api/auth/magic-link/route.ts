import { LOGIN_RATE_LIMIT, LOGIN_RATE_WINDOW_MS, LOGIN_TOKEN_TTL_MS, hashToken, newToken } from "@/lib/auth";
import { ApiError, handle, publicUrl, readJson } from "@/lib/api";
import { escapeHtml } from "@/lib/campaign";
import { collections } from "@/lib/db";
import { sendMail } from "@/lib/mail";
import { validateEmail } from "@/lib/validation";

// Pedir un enlace para entrar. Se manda siempre, exista o no la cuenta: el
// primer ingreso crea la cuenta (es un SaaS con alta libre).
export const POST = handle(async (request: Request) => {
  const body = await readJson(request);
  const email = validateEmail(body.email);
  if (!email.ok) throw new ApiError(400, email.error);

  const { loginTokens } = await collections();
  const now = new Date();
  // Límite por email: que nadie use el formulario para llenarle el buzón a otro.
  const recent = await loginTokens.countDocuments({
    email: email.value,
    createdAt: { $gt: new Date(now.getTime() - LOGIN_RATE_WINDOW_MS) },
  });
  if (recent >= LOGIN_RATE_LIMIT) {
    throw new ApiError(429, "Ya te mandamos varios enlaces. Revisá tu correo o esperá unos minutos.");
  }

  const token = newToken();
  await loginTokens.insertOne({
    tokenHash: hashToken(token),
    email: email.value,
    expiresAt: new Date(now.getTime() + LOGIN_TOKEN_TTL_MS),
    usedAt: null,
    createdAt: now,
  });

  const link = `${publicUrl()}/auth/verify?token=${token}`;
  try {
    await sendMail({
      to: email.value,
      subject: "Tu enlace para entrar a Cartero",
      html: `<p>Hola,</p><p>Para entrar a Cartero, abrí este enlace. Vale 15 minutos y sirve una sola vez:</p><p><a href="${escapeHtml(link)}">Entrar a Cartero</a></p><p style="color:#667085">Si no lo pediste, ignorá este mail: sin el enlace nadie puede entrar.</p>`,
      text: `Para entrar a Cartero, abrí este enlace (vale 15 minutos, una sola vez):\n${link}\n\nSi no lo pediste, ignorá este mail.`,
    });
  } catch (error) {
    console.error("No se pudo mandar el enlace", error);
    throw new ApiError(502, "No pudimos mandar el mail. Probá de nuevo en un rato.");
  }
  return Response.json({ ok: true });
});
