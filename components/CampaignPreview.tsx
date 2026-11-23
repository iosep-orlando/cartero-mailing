"use client";

import { useEffect, useState } from "react";
import { formatBytes } from "@/lib/attachments";
import { api, errorMessage } from "@/lib/fetcher";
import FormError from "./FormError";
import { input, panel } from "./ui";

interface Preview {
  recipients: { id: string; name: string; email: string }[];
  recipientId: string;
  from: string;
  to: string;
  subject: string;
  html: string;
  attachments: { filename: string; size: number }[];
  usesSnapshot: boolean;
}

/** El mail tal cual lo recibe un destinatario, con el pie de baja incluido. */
export default function CampaignPreview({ campaignId }: { campaignId: string }) {
  const [clientId, setClientId] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<Preview>(`/api/campaigns/${campaignId}/preview`, { method: "POST", json: { clientId: clientId || undefined } })
      .then((data) => {
        if (cancelled) return;
        setPreview(data);
        setError(null);
      })
      .catch((err) => !cancelled && setError(errorMessage(err)));
    return () => {
      cancelled = true;
    };
  }, [campaignId, clientId]);

  if (error) return <FormError message={error} />;
  if (!preview) return <p className="text-muted">Armando el mail…</p>;

  return (
    <section className={`${panel} overflow-hidden`}>
      <div className="space-y-1 border-b border-line bg-paper p-4 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="pv-to" className="w-14 text-muted">Para</label>
          {preview.recipients.length > 1 ? (
            <select id="pv-to" value={preview.recipientId} onChange={(e) => setClientId(e.target.value)} className={`${input} w-auto py-1 text-sm`}>
              {preview.recipients.map((r) => (
                <option key={r.id} value={r.id}>{r.name ? `${r.name} <${r.email}>` : r.email}</option>
              ))}
            </select>
          ) : (
            <span id="pv-to">{preview.to}</span>
          )}
        </div>
        <p><span className="inline-block w-14 text-muted">De</span>{preview.from}</p>
        <p><span className="inline-block w-14 text-muted">Asunto</span><strong>{preview.subject}</strong></p>
        {preview.attachments.length > 0 && (
          <p>
            <span className="inline-block w-14 text-muted">Adjuntos</span>
            {preview.attachments.map((a) => `${a.filename} (${formatBytes(a.size)})`).join(", ")}
          </p>
        )}
        <p className="pt-1 text-xs text-muted">
          {preview.usesSnapshot
            ? "Es lo que se envió: la copia de la plantilla del momento del envío."
            : "Con la plantilla tal como está hoy. Los enlaces de esta vista no cuentan clics ni dan de baja a nadie."}
        </p>
      </div>
      {/* sandbox vacío: el HTML del mail no ejecuta nada en el panel. */}
      <iframe title="Cómo llega el mail" sandbox="" srcDoc={preview.html} className="h-[28rem] w-full bg-white" />
    </section>
  );
}
