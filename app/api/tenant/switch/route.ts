import { requireUser, startSession } from "@/lib/auth";
import { ApiError, handle, readJson } from "@/lib/api";
import { collections, toObjectId } from "@/lib/db";

/** Pasar a otra organización de las que soy miembro. */
export const POST = handle(async (request: Request) => {
  const user = await requireUser();
  const tenantId = toObjectId((await readJson(request)).tenantId);
  const { memberships } = await collections();
  if (!tenantId || !(await memberships.findOne({ tenantId, userId: user.userId }))) {
    throw new ApiError(403, "No sos miembro de esa organización.");
  }
  await startSession({ sub: user.sub, email: user.email, tid: tenantId.toString() });
  return Response.json({ ok: true });
});
