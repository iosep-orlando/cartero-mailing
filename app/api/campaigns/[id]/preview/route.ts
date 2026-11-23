import { ObjectId } from "mongodb";
import { requireTenant } from "@/lib/auth";
import { ApiError, handle, publicUrl, readJson } from "@/lib/api";
import { buildMessage, compileSnapshot } from "@/lib/campaign";
import { collections, toObjectId } from "@/lib/db";
import { checkTemplate } from "@/lib/handlebars";
import { fromAddress } from "@/lib/mail";
import { audienceFilter, getCampaign } from "@/lib/store/campaigns";

/**
 * "Ver cómo llega": el mail tal cual lo arma el worker para un destinatario,
 * con el pie de baja y los enlaces con seguimiento. No manda ni registra
 * nada. Antes del envío usa la plantilla actual; después, la copia que se
 * envió. { clientId? }: si no se elige, el primer destinatario.
 */
export const POST = handle(async (request: Request, ctx: RouteContext<"/api/campaigns/[id]/preview">) => {
  const caller = await requireTenant();
  const campaign = await getCampaign(caller.tenantId, (await ctx.params).id);
  const body = await readJson(request);
  const { clients, templates, tenants, attachments, deliveries } = await collections();

  const sent = campaign.snapshot !== null;
  const [template, tenant] = await Promise.all([
    sent ? null : templates.findOne({ _id: campaign.templateId, tenantId: caller.tenantId }),
    tenants.findOne({ _id: caller.tenantId }),
  ]);
  const source = campaign.snapshot ?? (template && { subject: template.subject, html: template.html });
  if (!source) throw new ApiError(409, "La plantilla de la campaña ya no existe.");
  const problem = checkTemplate(source.subject, source.html);
  if (problem) throw new ApiError(400, problem);

  // Para quién: los destinatarios reales (los envíos, si ya salió; si no,
  // el público de hoy), hasta 50 para elegir.
  const recipients = sent
    ? (await deliveries.find({ tenantId: caller.tenantId, campaignId: campaign._id }).sort({ createdAt: 1 }).limit(50).toArray()).map(
        (d) => ({ id: d.clientId.toString(), name: d.name, email: d.email }),
      )
    : (await clients.find(audienceFilter(caller.tenantId, campaign.tags)).sort({ name: 1 }).limit(50).toArray()).map((c) => ({
        id: c._id.toString(),
        name: c.name,
        email: c.email,
      }));
  const chosenId = toObjectId(body.clientId)?.toString();
  const recipient = recipients.find((r) => r.id === chosenId) ?? recipients[0] ?? { id: "", name: "Ana Pérez", email: "ana@ejemplo.com" };

  const organization = campaign.snapshot?.tenantName ?? tenant?.name ?? "";
  const message = buildMessage(compileSnapshot(source), {
    base: publicUrl(),
    // Un id que no es de ningún envío: los enlaces se ven como los reales,
    // pero abrirlos no cuenta ni da de baja a nadie.
    deliveryId: new ObjectId("000000000000000000000000").toString(),
    client: recipient,
    organization,
  });
  const files = await attachments
    .find({ _id: { $in: campaign.attachmentIds }, tenantId: caller.tenantId }, { projection: { data: 0 } })
    .toArray();

  return Response.json({
    recipients,
    recipientId: recipient.id,
    from: fromAddress(organization),
    to: recipient.email,
    subject: message.subject,
    html: message.html,
    attachments: files.map((f) => ({ filename: f.filename, size: f.size })),
    usesSnapshot: sent,
  });
});
