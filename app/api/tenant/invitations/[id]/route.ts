import { requireTenant } from "@/lib/auth";
import { ApiError, handle } from "@/lib/api";
import { collections, toObjectId } from "@/lib/db";

export const DELETE = handle(async (_request: Request, ctx: RouteContext<"/api/tenant/invitations/[id]">) => {
  const caller = await requireTenant("owner");
  const _id = toObjectId((await ctx.params).id);
  const { invitations } = await collections();
  const { deletedCount } = _id ? await invitations.deleteOne({ _id, tenantId: caller.tenantId }) : { deletedCount: 0 };
  if (deletedCount === 0) throw new ApiError(404, "No existe esa invitación.");
  return new Response(null, { status: 204 });
});
