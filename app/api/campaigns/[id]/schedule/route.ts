import { requireTenant } from "@/lib/auth";
import { ApiError, handle, readJson } from "@/lib/api";
import { collections } from "@/lib/db";
import { getCampaign } from "@/lib/store/campaigns";
import { validateSchedule } from "@/lib/validation";

type Ctx = RouteContext<"/api/campaigns/[id]/schedule">;

/** Programar (o reprogramar): { scheduledAt } en ISO. */
export const POST = handle(async (request: Request, ctx: Ctx) => {
  const caller = await requireTenant();
  const doc = await getCampaign(caller.tenantId, (await ctx.params).id);
  const when = validateSchedule((await readJson(request)).scheduledAt);
  if (!when.ok) throw new ApiError(400, when.error);
  const { campaigns } = await collections();
  const { modifiedCount } = await campaigns.updateOne(
    { _id: doc._id, tenantId: caller.tenantId, status: { $in: ["draft", "scheduled"] } },
    { $set: { status: "scheduled", scheduledAt: when.value, updatedAt: new Date() } },
  );
  if (modifiedCount === 0) throw new ApiError(409, "Ya se envió o se está enviando.");
  return Response.json({ scheduledAt: when.value.toISOString() });
});

/** Cancelar la programación: vuelve a borrador. */
export const DELETE = handle(async (_request: Request, ctx: Ctx) => {
  const caller = await requireTenant();
  const doc = await getCampaign(caller.tenantId, (await ctx.params).id);
  const { campaigns } = await collections();
  const { modifiedCount } = await campaigns.updateOne(
    { _id: doc._id, tenantId: caller.tenantId, status: "scheduled" },
    { $set: { status: "draft", scheduledAt: null, updatedAt: new Date() } },
  );
  if (modifiedCount === 0) throw new ApiError(409, "Ya no está programada: puede que haya empezado a enviarse.");
  return Response.json({ ok: true });
});
