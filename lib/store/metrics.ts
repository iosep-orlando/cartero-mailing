import type { ObjectId } from "mongodb";
import { collections } from "../db";
import type { CampaignDTO } from "../types";
import { toDTOs } from "./campaigns";

export interface TenantMetrics {
  clients: number;
  subscribed: number;
  unsubscribed: number;
  bounced: number;
  templates: number;
  sent: number; // mails entregados al SMTP, en todas las campañas
  opened: number; // destinatarios que abrieron
  clicked: number; // destinatarios que hicieron clic
  scheduled: CampaignDTO[];
  recent: CampaignDTO[];
}

/** Las métricas del resumen, siempre de una sola organización. */
export async function tenantMetrics(tenantId: ObjectId): Promise<TenantMetrics> {
  const { clients, templates, campaigns } = await collections();
  const [clientCount, unsubscribed, bounced, templateCount, totals, scheduled, recent] = await Promise.all([
    clients.countDocuments({ tenantId }),
    clients.countDocuments({ tenantId, unsubscribed: true }),
    clients.countDocuments({ tenantId, unsubscribed: false, bounced: true }),
    templates.countDocuments({ tenantId }),
    campaigns
      .aggregate<{ sent: number; opened: number; clicked: number }>([
        { $match: { tenantId } },
        {
          $group: {
            _id: null,
            sent: { $sum: "$counts.sent" },
            opened: { $sum: "$counts.opened" },
            clicked: { $sum: "$counts.clicked" },
          },
        },
      ])
      .toArray(),
    campaigns.find({ tenantId, status: "scheduled" }).sort({ scheduledAt: 1 }).limit(5).toArray(),
    campaigns.find({ tenantId, status: { $in: ["sending", "sent"] } }).sort({ startedAt: -1 }).limit(5).toArray(),
  ]);
  const sum = totals[0] ?? { sent: 0, opened: 0, clicked: 0 };
  return {
    clients: clientCount,
    subscribed: clientCount - unsubscribed - bounced,
    unsubscribed,
    bounced,
    templates: templateCount,
    sent: sum.sent,
    opened: sum.opened,
    clicked: sum.clicked,
    scheduled: await toDTOs(scheduled),
    recent: await toDTOs(recent),
  };
}
