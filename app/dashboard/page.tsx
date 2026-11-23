import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import CampaignStatusBadge from "@/components/CampaignStatusBadge";
import { button, panel, pageTitle } from "@/components/ui";
import { rate } from "@/lib/campaign";
import { formatDateTime, formatNumber, plural } from "@/lib/format";
import { pageTenant } from "@/lib/page-auth";
import { tenantMetrics } from "@/lib/store/metrics";

export const metadata: Metadata = { title: "Resumen" };

export default function DashboardPage() {
  return (
    <main>
      <h1 className={pageTitle}>Resumen</h1>
      <Suspense fallback={<p className="mt-6 text-muted">Calculando…</p>}>
        <Metrics />
      </Suspense>
    </main>
  );
}

async function Metrics() {
  const caller = await pageTenant();
  const m = await tenantMetrics(caller.tenantId);

  if (m.clients === 0 && m.templates === 0) {
    return (
      <section className={`${panel} mt-6 p-6`}>
        <h2 className="text-lg font-semibold">Primeros pasos</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-muted">
          <li><Link href="/dashboard/clients" className="font-semibold text-correo hover:underline">Cargá tus clientes</Link>, a mano o importando un CSV.</li>
          <li><Link href="/dashboard/templates" className="font-semibold text-correo hover:underline">Escribí una plantilla</Link> con variables como {"{{firstName}}"}.</li>
          <li><Link href="/dashboard/campaigns/new" className="font-semibold text-correo hover:underline">Armá una campaña</Link> y enviala o programala.</li>
        </ol>
      </section>
    );
  }

  return (
    <div className="mt-6 space-y-6">
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Clientes suscritos" value={formatNumber(m.subscribed)} note={`${plural(m.unsubscribed, "dado de baja", "dados de baja")}${m.bounced > 0 ? ` · ${plural(m.bounced, "rebotó", "rebotaron")}` : ""}`} />
        <Stat label="Mails enviados" value={formatNumber(m.sent)} note="en todas las campañas" />
        <Stat label="Abrieron" value={`${rate(m.opened, m.sent)} %`} note={plural(m.opened, "persona", "personas")} />
        <Stat label="Hicieron clic" value={`${rate(m.clicked, m.sent)} %`} note={plural(m.clicked, "persona", "personas")} />
      </dl>

      {m.scheduled.length > 0 && (
        <section className={`${panel} p-5`}>
          <h2 className="font-semibold">Programadas</h2>
          <ul className="mt-2 divide-y divide-line">
            {m.scheduled.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <Link href={`/dashboard/campaigns/${c.id}`} className="font-semibold hover:underline">{c.name}</Link>
                <span className="text-sm text-muted">{formatDateTime(c.scheduledAt)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={`${panel} p-5`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">Últimas campañas enviadas</h2>
          <Link href="/dashboard/campaigns/new" className={button}>Nueva campaña</Link>
        </div>
        {m.recent.length === 0 ? (
          <p className="mt-3 text-muted">Todavía no enviaste ninguna.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[34rem] text-left text-sm">
              <thead className="border-b border-line text-muted">
                <tr>
                  <th className="py-2 font-semibold">Campaña</th>
                  <th className="py-2 font-semibold">Estado</th>
                  <th className="py-2 text-right font-semibold">Enviados</th>
                  <th className="py-2 text-right font-semibold">Abrieron</th>
                  <th className="py-2 text-right font-semibold">Clic</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {m.recent.map((c) => (
                  <tr key={c.id}>
                    <td className="py-2"><Link href={`/dashboard/campaigns/${c.id}`} className="font-semibold hover:underline">{c.name}</Link></td>
                    <td className="py-2"><CampaignStatusBadge status={c.status} /></td>
                    <td className="tabular py-2 text-right">{formatNumber(c.counts.sent)}</td>
                    <td className="tabular py-2 text-right">{rate(c.counts.opened, c.counts.sent)} %</td>
                    <td className="tabular py-2 text-right">{rate(c.counts.clicked, c.counts.sent)} %</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <p className="text-xs text-muted">
        Las aperturas se cuentan con una imagen invisible: los programas que no cargan imágenes no las registran,
        y algunos (Gmail, Apple Mail) las cargan solos. Son una estimación; los clics son exactos.
      </p>
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className={`${panel} p-4`}>
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="tabular mt-1 text-2xl font-bold">{value}</dd>
      <dd className="mt-1 text-xs text-muted">{note}</dd>
    </div>
  );
}
