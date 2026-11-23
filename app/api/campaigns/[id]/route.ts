import { requireTenant } from "@/lib/auth";
import { ApiError, handle, readJson } from "@/lib/api";
import { canEdit } from "@/lib/campaign";
import { collections, deliveryToDTO, toObjectId } from "@/lib/db";
import { checkReferences, getCampaign, toDTOs } from "@/lib/store/campaigns";
import { validateCampaign } from "@/lib/validation";

type Ctx = RouteContext<"/api/campaigns/[id]">;

/** La campaña con sus envíos (hasta 1000), para la pantalla de detalle y su progreso. */
export const GET = handle(async (_request: Request, ctx: Ctx) => {
  const caller = await requireTenant();
  const doc = await getCampaign(caller.tenantId, (await ctx.params).id);
  const { deliveries } = await collections();
  const list = await deliveries
    .find({ tenantId: caller.tenantId, campaignId: doc._id })
    .sort({ createdAt: 1 })
    .limit(1000)
    .toArray();
  const [campaign] = await toDTOs([doc]);
  return Response.json({ campaign, deliveries: list.map(deliveryToDTO) });
});

/** Editar: solo un borrador. */
export const PATCH = handle(async (request: Request, ctx: Ctx) => {
  const caller = await requireTenant();
  const doc = await getCampaign(caller.tenantId, (await ctx.params).id);
  if (!canEdit(doc.status)) throw new ApiError(409, "Solo se edita un borrador. Si está programada, cancelá la programación.");
  const input = validateCampaign(await readJson(request));
  if (!input.ok) throw new ApiError(400, input.error);
  await checkReferences(caller.tenantId, input.value);
  const { campaigns } = await collections();
  const { modifiedCount } = await campaigns.updateOne(
    { _id: doc._id, tenantId: caller.tenantId, status: "draft" },
    {
      $set: {
        name: input.value.name,
        templateId: toObjectId(input.value.templateId)!,
        tags: input.value.tags,
        attachmentIds: input.value.attachmentIds.map((id) => toObjectId(id)!),
        updatedAt: new Date(),
      },
    },
  );
  if (modifiedCount === 0) throw new ApiError(409, "La campaña cambió mientras tanto. Recargá.");
  return Response.json({ ok: true });
});

/** Borrar: un borrador (con lo enviado se pierde el historial: no se permite). */
export const DELETE = handle(async (_request: Request, ctx: Ctx) => {
  const caller = await requireTenant();
  const doc = await getCampaign(caller.tenantId, (await ctx.params).id);
  const { campaigns } = await collections();
  const { deletedCount } = await campaigns.deleteOne({ _id: doc._id, tenantId: caller.tenantId, status: "draft" });
  if (deletedCount === 0) throw new ApiError(409, "Solo se borra un borrador.");
  return new Response(null, { status: 204 });
});
