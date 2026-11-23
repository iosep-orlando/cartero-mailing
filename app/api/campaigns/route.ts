import { requireTenant } from "@/lib/auth";
import { ApiError, handle, readJson } from "@/lib/api";
import { EMPTY_COUNTS, collections, toObjectId, type CampaignDoc } from "@/lib/db";
import { checkReferences, toDTOs } from "@/lib/store/campaigns";
import { validateCampaign } from "@/lib/validation";

export const GET = handle(async () => {
  const caller = await requireTenant();
  const { campaigns } = await collections();
  const docs = await campaigns.find({ tenantId: caller.tenantId }).sort({ createdAt: -1 }).limit(200).toArray();
  return Response.json({ campaigns: await toDTOs(docs) });
});

/** Crear una campaña: nace como borrador. */
export const POST = handle(async (request: Request) => {
  const caller = await requireTenant();
  const input = validateCampaign(await readJson(request));
  if (!input.ok) throw new ApiError(400, input.error);
  await checkReferences(caller.tenantId, input.value);
  const { campaigns } = await collections();
  const now = new Date();
  const doc: CampaignDoc = {
    tenantId: caller.tenantId,
    name: input.value.name,
    templateId: toObjectId(input.value.templateId)!,
    tags: input.value.tags,
    attachmentIds: input.value.attachmentIds.map((id) => toObjectId(id)!),
    status: "draft",
    snapshot: null,
    scheduledAt: null,
    startedAt: null,
    finishedAt: null,
    counts: EMPTY_COUNTS,
    createdBy: caller.userId,
    createdAt: now,
    updatedAt: now,
  };
  const { insertedId } = await campaigns.insertOne(doc);
  return Response.json({ id: insertedId.toString() }, { status: 201 });
});
