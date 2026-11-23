import { requireTenant } from "@/lib/auth";
import { ApiError, handle, readJson } from "@/lib/api";
import { clientToDTO, collections, isDuplicateKey, toObjectId } from "@/lib/db";
import { validateClient } from "@/lib/validation";

type Ctx = RouteContext<"/api/clients/[id]">;

export const PATCH = handle(async (request: Request, ctx: Ctx) => {
  const caller = await requireTenant();
  const _id = toObjectId((await ctx.params).id);
  const input = validateClient(await readJson(request));
  if (!input.ok) throw new ApiError(400, input.error);
  const { clients } = await collections();
  try {
    // _id + tenantId: un id de otra organización no encuentra nada (404).
    const before = _id ? await clients.findOne({ _id, tenantId: caller.tenantId }) : null;
    // Si se corrigió el email, el rebote era de la dirección vieja: se borra.
    const emailChanged = before !== null && before.email !== input.value.email;
    const doc = before
      ? await clients.findOneAndUpdate(
          { _id: before._id, tenantId: caller.tenantId },
          { $set: { ...input.value, ...(emailChanged ? { bounced: false, bounceReason: null } : {}), updatedAt: new Date() } },
          { returnDocument: "after" },
        )
      : null;
    if (!doc) throw new ApiError(404, "No existe ese cliente.");
    return Response.json({ client: clientToDTO(doc) });
  } catch (error) {
    if (isDuplicateKey(error)) throw new ApiError(409, "Ya tenés otro cliente con ese email.");
    throw error;
  }
});

export const DELETE = handle(async (_request: Request, ctx: Ctx) => {
  const caller = await requireTenant();
  const _id = toObjectId((await ctx.params).id);
  const { clients } = await collections();
  const { deletedCount } = _id ? await clients.deleteOne({ _id, tenantId: caller.tenantId }) : { deletedCount: 0 };
  if (deletedCount === 0) throw new ApiError(404, "No existe ese cliente.");
  return new Response(null, { status: 204 });
});
