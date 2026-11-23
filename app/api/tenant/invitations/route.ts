import { requireTenant } from "@/lib/auth";
import { ApiError, handle, publicUrl, readJson } from "@/lib/api";
import { escapeHtml } from "@/lib/campaign";
import { collections, isDuplicateKey } from "@/lib/db";
import { sendMail } from "@/lib/mail";
import { validateEmail } from "@/lib/validation";

/**
 * Invitar a alguien (solo el dueño). Si ya tiene cuenta, entra a la
 * organización en el momento; si no, la invitación espera a su primer
 * ingreso. En los dos casos le llega un mail.
 */
export const POST = handle(async (request: Request) => {
  const caller = await requireTenant("owner");
  const email = validateEmail((await readJson(request)).email);
  if (!email.ok) throw new ApiError(400, email.error);
  const { users, memberships, invitations, tenants } = await collections();
  const now = new Date();
  const existing = await users.findOne({ email: email.value });
  if (existing && (await memberships.findOne({ tenantId: caller.tenantId, userId: existing._id }))) {
    throw new ApiError(409, "Esa persona ya es miembro.");
  }
  if (existing) {
    await memberships.insertOne({ tenantId: caller.tenantId, userId: existing._id, role: "member", createdAt: now });
  } else {
    try {
      await invitations.insertOne({ tenantId: caller.tenantId, email: email.value, invitedBy: caller.userId, createdAt: now });
    } catch (error) {
      if (isDuplicateKey(error)) throw new ApiError(409, "Ya hay una invitación pendiente para ese email.");
      throw error;
    }
  }
  const tenant = await tenants.findOne({ _id: caller.tenantId });
  const org = escapeHtml(tenant?.name ?? "");
  const link = `${publicUrl()}/login?email=${encodeURIComponent(email.value)}`;
  try {
    await sendMail({
      to: email.value,
      subject: `Te invitaron a ${tenant?.name ?? "una organización"} en Cartero`,
      html: `<p>${escapeHtml(caller.email)} te invitó a trabajar en <strong>${org}</strong> en Cartero.</p><p><a href="${escapeHtml(link)}">Entrar a Cartero</a> (con este mismo email; no hace falta contraseña).</p>`,
      text: `${caller.email} te invitó a ${tenant?.name ?? ""} en Cartero. Entrá con este email: ${link}`,
    });
  } catch (error) {
    // La invitación ya quedó hecha: el mail es un aviso.
    console.error("No se pudo mandar la invitación", error);
  }
  return Response.json({ joined: Boolean(existing) }, { status: 201 });
});
