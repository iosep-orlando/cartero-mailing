"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useState, type FormEvent } from "react";
import { formatBytes } from "@/lib/attachments";
import { api, errorMessage } from "@/lib/fetcher";
import { formatNumber } from "@/lib/format";
import type { AttachmentDTO, CampaignDTO, TemplateDTO } from "@/lib/types";
import FormError from "./FormError";
import { button, buttonSecondary, input, label, panel } from "./ui";

interface Options {
  templates: TemplateDTO[];
  tags: string[];
  attachments: AttachmentDTO[];
}

/** Crear una campaña, o editar un borrador (campaign + onSaved). */
export default function CampaignForm({ campaign, onSaved }: { campaign?: CampaignDTO; onSaved?: () => void }) {
  const router = useRouter();
  const [options, setOptions] = useState<Options | null>(null);
  const [name, setName] = useState(campaign?.name ?? "");
  const [templateId, setTemplateId] = useState(campaign?.templateId ?? "");
  const [tags, setTags] = useState<string[]>(campaign?.tags ?? []);
  const [attachmentIds, setAttachmentIds] = useState<string[]>(campaign?.attachmentIds ?? []);
  const [audience, setAudience] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Next.js 16 esconde esta página al salir: al volver a "Nueva campaña", de cero.
  useLayoutEffect(() => {
    if (campaign) return;
    return () => {
      setName("");
      setTemplateId("");
      setTags([]);
      setAttachmentIds([]);
      setPending(false);
      setError(null);
    };
  }, [campaign]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api<{ templates: TemplateDTO[] }>("/api/templates"),
      api<{ tags: string[] }>("/api/clients"),
      api<{ attachments: AttachmentDTO[] }>("/api/attachments"),
    ])
      .then(([t, c, a]) => {
        if (cancelled) return;
        setOptions({ templates: t.templates, tags: c.tags, attachments: a.attachments });
        setTemplateId((current) => current || t.templates[0]?.id || "");
      })
      .catch((err) => !cancelled && setError(errorMessage(err)));
    return () => {
      cancelled = true;
    };
  }, []);

  // ¿A cuántos les llegaría? Se recalcula al cambiar las etiquetas.
  useEffect(() => {
    let cancelled = false;
    api<{ count: number }>(`/api/campaigns/audience?tags=${encodeURIComponent(tags.join(","))}`)
      .then((data) => !cancelled && setAudience(data.count))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [tags]);

  const toggle = (list: string[], value: string) =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const body = { name, templateId, tags, attachmentIds };
    try {
      if (campaign) {
        await api(`/api/campaigns/${campaign.id}`, { method: "PATCH", json: body });
        onSaved?.();
        setPending(false);
      } else {
        const { id } = await api<{ id: string }>("/api/campaigns", { method: "POST", json: body });
        router.push(`/dashboard/campaigns/${id}`);
      }
    } catch (err) {
      setError(errorMessage(err));
      setPending(false);
    }
  }

  if (options && options.templates.length === 0) {
    return (
      <p className="mt-6 text-muted">
        Primero necesitás una plantilla.{" "}
        <Link href="/dashboard/templates" className="font-semibold text-correo hover:underline">Crear una</Link>
      </p>
    );
  }

  return (
    <form onSubmit={submit} className={`${panel} mt-6 space-y-5 p-5`}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="cp-name" className={label}>Nombre de la campaña</label>
          <input id="cp-name" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej.: Novedades de diciembre" className={input} />
        </div>
        <div>
          <label htmlFor="cp-template" className={label}>Plantilla</label>
          <select id="cp-template" required value={templateId} onChange={(e) => setTemplateId(e.target.value)} className={input}>
            {options?.templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      </div>

      <fieldset>
        <legend className={label}>Destinatarios</legend>
        {options && options.tags.length === 0 ? (
          <p className="text-sm text-muted">Todos los clientes suscritos (no hay etiquetas para elegir un segmento).</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setTags([])}
              aria-pressed={tags.length === 0}
              className={`rounded-full border px-3 py-1 text-sm font-semibold ${tags.length === 0 ? "border-correo bg-correo text-white" : "border-line bg-white"}`}
            >
              Todos
            </button>
            {options?.tags.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTags(toggle(tags, t))}
                aria-pressed={tags.includes(t)}
                className={`rounded-full border px-3 py-1 text-sm font-semibold ${tags.includes(t) ? "border-correo bg-correo text-white" : "border-line bg-white"}`}
              >
                {t}
              </button>
            ))}
          </div>
        )}
        <p className="mt-2 text-sm text-muted" aria-live="polite">
          {audience === null
            ? "Contando…"
            : `Le llegaría a ${audience === 1 ? "1 persona" : `${formatNumber(audience)} personas`}${tags.length > 0 ? " con alguna de esas etiquetas" : ""}. Los dados de baja y los que rebotaron no cuentan.`}
        </p>
      </fieldset>

      <fieldset>
        <legend className={label}>Adjuntos</legend>
        {options?.attachments.length === 0 ? (
          <p className="text-sm text-muted">
            Ninguno. Podés subir archivos en <Link href="/dashboard/attachments" className="font-semibold text-correo hover:underline">Adjuntos</Link>.
          </p>
        ) : (
          <ul className="space-y-1">
            {options?.attachments.map((a) => (
              <li key={a.id}>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={attachmentIds.includes(a.id)} onChange={() => setAttachmentIds(toggle(attachmentIds, a.id))} className="h-4 w-4 accent-correo" />
                  {a.filename} <span className="text-muted">({formatBytes(a.size)})</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </fieldset>

      <FormError message={error} />
      <div className="flex gap-3">
        <button type="submit" disabled={pending || !options} className={button}>
          {pending ? "Guardando…" : campaign ? "Guardar cambios" : "Crear borrador"}
        </button>
        {campaign && onSaved && <button type="button" onClick={onSaved} className={buttonSecondary}>Cancelar</button>}
      </div>
      {!campaign && <p className="text-sm text-muted">Nada se envía todavía: en el borrador elegís enviar ahora o programar.</p>}
    </form>
  );
}
