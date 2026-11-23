import { requireTenant } from "@/lib/auth";
import { ApiError, handle } from "@/lib/api";
import { collections, toObjectId } from "@/lib/db";

type Ctx = RouteContext<"/api/attachments/[id]">;

/** Descargar un adjunto (solo los de la propia organización). */
export const GET = handle(async (_request: Request, ctx: Ctx) => {
  const caller = await requireTenant();
  const _id = toObjectId((await ctx.params).id);
  const { attachments } = await collections();
  const doc = _id ? await attachments.findOne({ _id, tenantId: caller.tenantId }) : null;
  if (!doc) throw new ApiError(404, "No existe ese adjunto.");
  return new Response(Buffer.from(doc.data.buffer).subarray(0, doc.size), {
    headers: {
      "content-type": doc.contentType,
      // attachment: se descarga, no se abre en la página (un HTML subido no se ejecuta).
      "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(doc.filename)}`,
      "x-content-type-options": "nosniff",
    },
  });
});

/** Borrar, salvo que lo use una campaña que todavía no salió. */
export const DELETE = handle(async (_request: Request, ctx: Ctx) => {
  const caller = await requireTenant();
  const _id = toObjectId((await ctx.params).id);
  if (!_id) throw new ApiError(404, "No existe ese adjunto.");
  const { attachments, campaigns } = await collections();
  const inUse = await campaigns.countDocuments({
    tenantId: caller.tenantId,
    attachmentIds: _id,
    status: { $in: ["draft", "scheduled", "sending"] },
  });
  if (inUse > 0) throw new ApiError(409, "Lo usa una campaña que todavía no terminó de enviarse.");
  const { deletedCount } = await attachments.deleteOne({ _id, tenantId: caller.tenantId });
  if (deletedCount === 0) throw new ApiError(404, "No existe ese adjunto.");
  return new Response(null, { status: 204 });
});
