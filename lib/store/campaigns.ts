import type { Filter, ObjectId } from "mongodb";
import { ApiError } from "../api";
import { campaignToDTO, collections, toObjectId, type CampaignDoc, type ClientDoc } from "../db";
import type { CampaignDTO } from "../types";
import type { CampaignInput } from "../validation";
import type { WithId } from "mongodb";

/** La campaña de esta organización, o un 404 (también si es de otra). */
export async function getCampaign(tenantId: ObjectId, id: string): Promise<WithId<CampaignDoc>> {
  const _id = toObjectId(id);
  const { campaigns } = await collections();
  const doc = _id ? await campaigns.findOne({ _id, tenantId }) : null;
  if (!doc) throw new ApiError(404, "No existe esa campaña.");
  return doc;
}

/** Plantilla y adjuntos tienen que ser de la misma organización. */
export async function checkReferences(tenantId: ObjectId, input: CampaignInput): Promise<void> {
  const { templates, attachments } = await collections();
  const template = await templates.findOne({ _id: toObjectId(input.templateId)!, tenantId });
  if (!template) throw new ApiError(400, "Esa plantilla no existe.");
  const ids = input.attachmentIds.map((id) => toObjectId(id)!);
  if (ids.length > 0) {
    const found = await attachments.countDocuments({ _id: { $in: ids }, tenantId });
    if (found !== ids.length) throw new ApiError(400, "Algún adjunto ya no existe.");
  }
}

export async function toDTOs(docs: WithId<CampaignDoc>[]): Promise<CampaignDTO[]> {
  const { templates } = await collections();
  const ids = [...new Set(docs.map((d) => d.templateId.toString()))].map((id) => toObjectId(id)!);
  const names = new Map(
    (await templates.find({ _id: { $in: ids } }, { projection: { name: 1 } }).toArray()).map((t) => [
      t._id.toString(),
      t.name,
    ]),
  );
  return docs.map((doc) => campaignToDTO(doc, names.get(doc.templateId.toString()) ?? "(plantilla borrada)"));
}

/**
 * A quién le llega una campaña: los clientes de la organización que no se
 * dieron de baja ni rebotaron y, si la campaña tiene etiquetas, que tengan
 * al menos una. La usan el contador del formulario, la vista previa y el
 * worker: los tres cuentan a las mismas personas.
 */
export function audienceFilter(tenantId: ObjectId, tags: string[]): Filter<ClientDoc> {
  return {
    tenantId,
    unsubscribed: false,
    bounced: { $ne: true },
    ...(tags.length > 0 ? { tags: { $in: tags } } : {}),
  };
}

export async function audienceSize(tenantId: ObjectId, tags: string[]): Promise<number> {
  const { clients } = await collections();
  return clients.countDocuments(audienceFilter(tenantId, tags));
}
