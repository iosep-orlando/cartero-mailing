import { requireTenant } from "@/lib/auth";
import { handle } from "@/lib/api";
import { EMPTY_COUNTS, collections } from "@/lib/db";
import { getCampaign } from "@/lib/store/campaigns";

/** Una campaña enviada no se reenvía: se duplica como borrador nuevo. */
export const POST = handle(async (_request: Request, ctx: RouteContext<"/api/campaigns/[id]/duplicate">) => {
  const caller = await requireTenant();
  const doc = await getCampaign(caller.tenantId, (await ctx.params).id);
  const { campaigns } = await collections();
  const now = new Date();
  const { insertedId } = await campaigns.insertOne({
    tenantId: caller.tenantId,
    name: `${doc.name} (copia)`.slice(0, 120),
    templateId: doc.templateId,
    tags: doc.tags,
    attachmentIds: doc.attachmentIds,
    status: "draft",
    snapshot: null,
    scheduledAt: null,
    startedAt: null,
    finishedAt: null,
    counts: EMPTY_COUNTS,
    createdBy: caller.userId,
    createdAt: now,
    updatedAt: now,
  });
  return Response.json({ id: insertedId.toString() }, { status: 201 });
});
