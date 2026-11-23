import { requireTenant } from "@/lib/auth";
import { ApiError, handle } from "@/lib/api";
import { collections, toObjectId } from "@/lib/db";

/** Quitar a un miembro (solo el dueño, y no a sí mismo). */
export const DELETE = handle(async (_request: Request, ctx: RouteContext<"/api/tenant/members/[userId]">) => {
  const caller = await requireTenant("owner");
  const userId = toObjectId((await ctx.params).userId);
  if (!userId) throw new ApiError(404, "No existe ese miembro.");
  if (userId.equals(caller.userId)) throw new ApiError(409, "No podés quitarte a vos, que sos el dueño.");
  const { memberships } = await collections();
  const { deletedCount } = await memberships.deleteOne({ tenantId: caller.tenantId, userId });
  if (deletedCount === 0) throw new ApiError(404, "No existe ese miembro.");
  return new Response(null, { status: 204 });
});
