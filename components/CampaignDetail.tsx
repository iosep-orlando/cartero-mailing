"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { canEdit, canSend, canSchedule, canUnschedule, rate } from "@/lib/campaign";
import { api, errorMessage } from "@/lib/fetcher";
import { formatDateTime, formatNumber, fromLocalInput, plural, toLocalInput } from "@/lib/format";
import type { CampaignDTO, DeliveryDTO, DeliveryStatus } from "@/lib/types";
import CampaignForm from "./CampaignForm";
import CampaignPreview from "./CampaignPreview";
import CampaignStatusBadge from "./CampaignStatusBadge";
import FormError from "./FormError";
import { button, buttonDanger, buttonSecondary, input, label, panel } from "./ui";

const DELIVERY_LABEL: Record<DeliveryStatus, string> = {
  pending: "En cola",
  sending: "Enviando",
  sent: "Enviado",
  failed: "Falló",
  skipped: "Omitido",
};

export default function CampaignDetail({ id }: { id: string }) {
  const router = useRouter();
  const [campaign, setCampaign] = useState<CampaignDTO | null>(null);
  const [deliveries, setDeliveries] = useState<DeliveryDTO[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"view" | "edit" | "schedule" | "confirm-send" | "confirm-delete">("view");
  const [when, setWhen] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api<{ campaign: CampaignDTO; deliveries: DeliveryDTO[] }>(`/api/campaigns/${id}`);
      setCampaign(data.campaign);
      setDeliveries(data.deliveries);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [id]);

  // Carga al mostrarse; mientras se envía (o está por salir), cada 2 segundos.
  const live = campaign?.status === "sending" || campaign?.status === "scheduled";
  useEffect(() => {
    let cancelled = false;
    const run = () => void (!cancelled && load());
    run();
    const timer = live ? setInterval(run, campaign?.status === "sending" ? 2000 : 15000) : undefined;
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [load, live, campaign?.status]);

  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      setMode("view");
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (!campaign) return error ? <div className="mt-6"><FormError message={error} /></div> : <p className="mt-6 text-muted">Cargando…</p>;

  const c = campaign.counts;
  const done = c.sent + c.failed + c.skipped;

  return (
    <div className="mt-2 space-y-6">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="display text-3xl">{campaign.name}</h1>
        <CampaignStatusBadge status={campaign.status} />
      </header>
      <p className="text-muted">
        Plantilla <strong className="text-ink">{campaign.templateName}</strong> ·{" "}
        {campaign.tags.length > 0 ? <>clientes con <strong className="text-ink">{campaign.tags.join(", ")}</strong></> : "todos los clientes suscritos"}
        {campaign.attachmentIds.length > 0 && ` · ${plural(campaign.attachmentIds.length, "adjunto", "adjuntos")}`}
      </p>

      {campaign.status === "scheduled" && (
        <p className={`${panel} p-4`}>
          Sale sola el <strong>{formatDateTime(campaign.scheduledAt)}</strong> (hora argentina).
        </p>
      )}

      {/* Acciones según el estado */}
      {mode === "view" && (
        <div className="flex flex-wrap gap-3">
          {canSend(campaign.status) && <button type="button" onClick={() => setMode("confirm-send")} className={button}>Enviar ahora</button>}
          {canSchedule(campaign.status) && (
            <button
              type="button"
              onClick={() => {
                setWhen(campaign.scheduledAt ? toLocalInput(new Date(campaign.scheduledAt)) : toLocalInput(new Date(Date.now() + 60 * 60 * 1000)));
                setMode("schedule");
              }}
              className={buttonSecondary}
            >
              {campaign.status === "scheduled" ? "Cambiar fecha" : "Programar"}
            </button>
          )}
          {canUnschedule(campaign.status) && (
            <button type="button" disabled={busy} onClick={() => act(() => api(`/api/campaigns/${id}/schedule`, { method: "DELETE" }))} className={buttonSecondary}>
              Cancelar programación
            </button>
          )}
          {canEdit(campaign.status) && <button type="button" onClick={() => setMode("edit")} className={buttonSecondary}>Editar</button>}
          <button type="button" onClick={() => setShowPreview(!showPreview)} aria-expanded={showPreview} className={buttonSecondary}>
            {showPreview ? "Ocultar el mail" : "Ver cómo llega"}
          </button>
          {(campaign.status === "sent" || campaign.status === "sending") && (
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const { id: copy } = await api<{ id: string }>(`/api/campaigns/${id}/duplicate`, { method: "POST" });
                  router.push(`/dashboard/campaigns/${copy}`);
                } catch (err) {
                  setError(errorMessage(err));
                  setBusy(false);
                }
              }}
              className={buttonSecondary}
            >
              Duplicar como borrador
            </button>
          )}
          {campaign.status === "draft" && <button type="button" onClick={() => setMode("confirm-delete")} className={`${buttonDanger} sm:ml-auto`}>Borrar</button>}
        </div>
      )}

      {mode === "confirm-send" && (
        <div className={`${panel} space-y-3 p-4`}>
          <p>Se manda ya a todos los destinatarios. No se puede deshacer.</p>
          <div className="flex gap-3">
            <button type="button" disabled={busy} onClick={() => act(() => api(`/api/campaigns/${id}/send`, { method: "POST" }))} className={button}>
              {busy ? "Arrancando…" : "Sí, enviar ahora"}
            </button>
            <button type="button" onClick={() => setMode("view")} className={buttonSecondary}>No</button>
          </div>
        </div>
      )}

      {mode === "schedule" && (
        <form
          className={`${panel} flex flex-wrap items-end gap-3 p-4`}
          onSubmit={(event) => {
            event.preventDefault();
            const scheduledAt = fromLocalInput(when);
            if (!scheduledAt) return setError("Fecha y hora inválidas.");
            void act(() => api(`/api/campaigns/${id}/schedule`, { method: "POST", json: { scheduledAt } }));
          }}
        >
          <div>
            <label htmlFor="when" className={label}>Fecha y hora (Argentina)</label>
            <input id="when" type="datetime-local" required value={when} onChange={(e) => setWhen(e.target.value)} className={input} />
          </div>
          <button type="submit" disabled={busy} className={button}>{busy ? "Guardando…" : "Programar"}</button>
          <button type="button" onClick={() => setMode("view")} className={buttonSecondary}>Cancelar</button>
        </form>
      )}

      {mode === "confirm-delete" && (
        <div className={`${panel} flex flex-wrap items-center gap-3 p-4`}>
          <p>¿Borrar este borrador?</p>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await api(`/api/campaigns/${id}`, { method: "DELETE" });
                router.push("/dashboard/campaigns");
              } catch (err) {
                setError(errorMessage(err));
                setBusy(false);
              }
            }}
            className={buttonDanger}
          >
            Sí, borrar
          </button>
          <button type="button" onClick={() => setMode("view")} className={buttonSecondary}>No</button>
        </div>
      )}

      {mode === "edit" && <CampaignForm campaign={campaign} onSaved={() => { setMode("view"); void load(); }} />}

      <FormError message={error} />

      {showPreview && mode !== "edit" && <CampaignPreview key={`${campaign.id}-${campaign.status}`} campaignId={campaign.id} />}

      {campaign.status !== "draft" && campaign.status !== "scheduled" && (
        <section className="space-y-4">
          <div>
            <div className="flex justify-between text-sm">
              <span>{campaign.status === "sending" ? "Enviando…" : `Terminó ${formatDateTime(campaign.finishedAt)}`}</span>
              <span className="tabular">{formatNumber(done)} de {formatNumber(c.total)}</span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuemin={0} aria-valuemax={c.total} aria-valuenow={done}>
              <div className="h-full bg-correo transition-[width]" style={{ width: `${c.total ? (done / c.total) * 100 : 100}%` }} />
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Stat label="Enviados" value={formatNumber(c.sent)} />
            <Stat label="Fallaron" value={formatNumber(c.failed)} />
            <Stat label="Omitidos" value={formatNumber(c.skipped)} />
            <Stat label="Abrieron" value={`${rate(c.opened, c.sent)} %`} note={plural(c.opened, "persona", "personas")} />
            <Stat label="Hicieron clic" value={`${rate(c.clicked, c.sent)} %`} note={plural(c.clicked, "persona", "personas")} />
          </dl>
          <div className={`${panel} overflow-x-auto`}>
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="border-b border-line text-muted">
                <tr>
                  <th className="p-3 font-semibold">Destinatario</th>
                  <th className="p-3 font-semibold">Estado</th>
                  <th className="p-3 font-semibold">Enviado</th>
                  <th className="p-3 font-semibold">Abrió</th>
                  <th className="p-3 font-semibold">Clic</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {deliveries.map((d) => (
                  <tr key={d.id}>
                    <td className="p-3">
                      <p className="font-semibold">{d.name || d.email}</p>
                      {d.name && <p className="text-muted">{d.email}</p>}
                    </td>
                    <td className="p-3">
                      <span className={d.status === "failed" ? "font-semibold text-sello" : ""}>{DELIVERY_LABEL[d.status]}</span>
                      {d.error && <p className="text-xs text-muted">{d.error}</p>}
                    </td>
                    <td className="p-3 text-muted">{formatDateTime(d.sentAt)}</td>
                    <td className="p-3 text-muted">{formatDateTime(d.openedAt)}</td>
                    <td className="p-3 text-muted">{formatDateTime(d.clickedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className={`${panel} p-3`}>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="tabular text-xl font-bold">{value}</dd>
      {note && <dd className="text-xs text-muted">{note}</dd>}
    </div>
  );
}
