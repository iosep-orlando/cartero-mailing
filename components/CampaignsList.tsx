"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { rate } from "@/lib/campaign";
import { api, errorMessage } from "@/lib/fetcher";
import { formatDateTime, formatNumber } from "@/lib/format";
import type { CampaignDTO } from "@/lib/types";
import CampaignStatusBadge from "./CampaignStatusBadge";
import FormError from "./FormError";
import { button, panel } from "./ui";

export default function CampaignsList() {
  const [campaigns, setCampaigns] = useState<CampaignDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<{ campaigns: CampaignDTO[] }>("/api/campaigns")
      .then((data) => !cancelled && setCampaigns(data.campaigns))
      .catch((err) => !cancelled && setError(errorMessage(err)));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mt-6 space-y-4">
      <Link href="/dashboard/campaigns/new" className={button}>Nueva campaña</Link>
      <FormError message={error} />
      {campaigns?.length === 0 && (
        <div className="rounded-lg border border-dashed border-line p-10 text-center text-muted">
          Todavía no hay campañas. Necesitás al menos una plantilla y algunos clientes.
        </div>
      )}
      {campaigns && campaigns.length > 0 && (
        <div className={`${panel} overflow-x-auto`}>
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="border-b border-line text-muted">
              <tr>
                <th className="p-3 font-semibold">Campaña</th>
                <th className="p-3 font-semibold">Estado</th>
                <th className="p-3 font-semibold">Cuándo</th>
                <th className="p-3 text-right font-semibold">Enviados</th>
                <th className="p-3 text-right font-semibold">Abrieron</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {campaigns.map((c) => (
                <tr key={c.id}>
                  <td className="p-3">
                    <Link href={`/dashboard/campaigns/${c.id}`} className="font-semibold hover:underline">{c.name}</Link>
                    <p className="text-muted">{c.templateName}{c.tags.length > 0 && ` · ${c.tags.join(", ")}`}</p>
                  </td>
                  <td className="p-3"><CampaignStatusBadge status={c.status} /></td>
                  <td className="p-3 text-muted">
                    {c.status === "scheduled" ? formatDateTime(c.scheduledAt) : formatDateTime(c.startedAt ?? c.createdAt)}
                  </td>
                  <td className="tabular p-3 text-right">{c.status === "draft" ? "—" : `${formatNumber(c.counts.sent)} / ${formatNumber(c.counts.total)}`}</td>
                  <td className="tabular p-3 text-right">{c.counts.sent > 0 ? `${rate(c.counts.opened, c.counts.sent)} %` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
