import { requireTenant, requireUser, startSession } from "@/lib/auth";
import { ApiError, handle, readJson } from "@/lib/api";
import { collections } from "@/lib/db";
import { validateOrgName } from "@/lib/validation";

/** Crear una organización: quien la crea es su dueño y pasa a trabajar en ella. */
export const POST = handle(async (request: Request) => {
  const user = await requireUser();
  const name = validateOrgName((await readJson(request)).name);
  if (!name.ok) throw new ApiError(400, name.error);
  const { tenants, memberships } = await collections();
  const now = new Date();
  const { insertedId } = await tenants.insertOne({ name: name.value, createdAt: now });
  await memberships.insertOne({ tenantId: insertedId, userId: user.userId, role: "owner", createdAt: now });
  await startSession({ sub: user.sub, email: user.email, tid: insertedId.toString() });
  return Response.json({ id: insertedId.toString(), name: name.value }, { status: 201 });
});

/** Cambiar el nombre (solo el dueño). */
export const PATCH = handle(async (request: Request) => {
  const caller = await requireTenant("owner");
  const name = validateOrgName((await readJson(request)).name);
  if (!name.ok) throw new ApiError(400, name.error);
  const { tenants } = await collections();
  await tenants.updateOne({ _id: caller.tenantId }, { $set: { name: name.value } });
  return Response.json({ name: name.value });
});
