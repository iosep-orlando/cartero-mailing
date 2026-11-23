"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api, errorMessage } from "@/lib/fetcher";
import { VARIABLES } from "@/lib/handlebars";
import type { ClientDTO, TemplateDTO } from "@/lib/types";
import FormError from "./FormError";
import { button, buttonDanger, buttonSecondary, input, label, panel } from "./ui";

interface Fields {
  name: string;
  subject: string;
  html: string;
}

export default function TemplateEditor({ id }: { id: string }) {
  const router = useRouter();
  const [saved, setSaved] = useState<Fields | null>(null);
  const [fields, setFields] = useState<Fields | null>(null);
  const [clients, setClients] = useState<ClientDTO[]>([]);
  const [clientId, setClientId] = useState("");
  const [preview, setPreview] = useState<{ subject: string; html: string } | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const htmlRef = useRef<HTMLTextAreaElement>(null);

  // Cargar plantilla y clientes al mostrarse (también al volver a la pantalla:
  // Next.js 16 la esconde en vez de cerrarla, así se ve lo último guardado).
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api<{ template: TemplateDTO }>(`/api/templates/${id}`),
      api<{ clients: ClientDTO[] }>("/api/clients"),
    ])
      .then(([{ template }, list]) => {
        if (cancelled) return;
        const loaded = { name: template.name, subject: template.subject, html: template.html };
        setSaved(loaded);
        setFields(loaded);
        setClients(list.clients.filter((c) => !c.unsubscribed).slice(0, 50));
        setStatus("idle");
        setConfirmDelete(false);
      })
      .catch((err) => !cancelled && setError(errorMessage(err)));
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Vista previa: medio segundo después de dejar de escribir.
  useEffect(() => {
    if (!fields) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      api<{ subject: string; html: string }>("/api/templates/preview", {
        method: "POST",
        json: { subject: fields.subject, html: fields.html, clientId: clientId || undefined },
      })
        .then((data) => {
          if (cancelled) return;
          setPreview(data);
          setPreviewError(null);
        })
        .catch((err) => !cancelled && setPreviewError(errorMessage(err)));
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [fields, clientId]);

  if (error && !fields) return <div className="mt-6"><FormError message={error} /></div>;
  if (!fields) return <p className="mt-6 text-muted">Cargando…</p>;

  const dirty = JSON.stringify(fields) !== JSON.stringify(saved);
  const set = (key: keyof Fields) => (event: { target: { value: string } }) => {
    setFields({ ...fields, [key]: event.target.value });
    setStatus("idle");
  };

  /** Inserta {{variable}} donde está el cursor en el contenido. */
  function insertVariable(key: string) {
    const area = htmlRef.current;
    const token = `{{${key}}}`;
    if (!area || !fields) return;
    const start = area.selectionStart ?? fields.html.length;
    const end = area.selectionEnd ?? start;
    const html = fields.html.slice(0, start) + token + fields.html.slice(end);
    setFields({ ...fields, html });
    requestAnimationFrame(() => {
      area.focus();
      area.setSelectionRange(start + token.length, start + token.length);
    });
  }

  async function save() {
    if (!fields) return;
    setStatus("saving");
    setError(null);
    try {
      await api(`/api/templates/${id}`, { method: "PATCH", json: fields });
      setSaved(fields);
      setStatus("saved");
    } catch (err) {
      setError(errorMessage(err));
      setStatus("idle");
    }
  }

  async function remove() {
    try {
      await api(`/api/templates/${id}`, { method: "DELETE" });
      router.push("/dashboard/templates");
    } catch (err) {
      setError(errorMessage(err));
      setConfirmDelete(false);
    }
  }

  return (
    <div className="mt-4 grid gap-6 xl:grid-cols-2">
      <section className="space-y-4">
        <div>
          <label htmlFor="t-name" className={label}>Nombre (solo lo ves vos)</label>
          <input id="t-name" value={fields.name} onChange={set("name")} maxLength={80} className={input} />
        </div>
        <div>
          <label htmlFor="t-subject" className={label}>Asunto</label>
          <input id="t-subject" value={fields.subject} onChange={set("subject")} maxLength={200} className={input} />
        </div>
        <div>
          <label htmlFor="t-html" className={label}>Contenido (HTML con variables Handlebars)</label>
          <textarea
            id="t-html"
            ref={htmlRef}
            value={fields.html}
            onChange={set("html")}
            rows={16}
            spellCheck={false}
            className={`${input} font-mono text-sm`}
          />
        </div>
        <div className={`${panel} p-4`}>
          <p className="text-sm font-semibold">Variables: tocá una para ponerla donde está el cursor</p>
          <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
            {VARIABLES.map((v) => (
              <li key={v.key}>
                <button type="button" onClick={() => insertVariable(v.key)} className="font-mono font-semibold text-correo hover:underline">
                  {`{{${v.key}}}`}
                </button>{" "}
                <span className="text-muted">{v.description}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">
            Con texto de reserva: <code>{'{{default firstName "qué tal"}}'}</code>. Los enlaces cuentan clics solos.
          </p>
        </div>
        <FormError message={error} />
        <div className="flex flex-wrap items-center gap-3">
          {dirty || status === "saving" ? (
            <button type="button" onClick={save} disabled={status === "saving"} className={button}>
              {status === "saving" ? "Guardando…" : "Guardar cambios"}
            </button>
          ) : (
            // Sin cambios: no hay nada que guardar, y el botón lo dice en
            // vez de quedar desteñido como si estuviera trabado.
            <span role="status" className={`${buttonSecondary} cursor-default gap-1.5`}>
              <span aria-hidden className="text-green-700">✓</span>
              {status === "saved" ? "Guardada" : "Sin cambios"}
            </span>
          )}
          {status === "saved" && !dirty && (
            <Link href="/dashboard/templates" className="text-sm font-semibold text-correo hover:underline">
              Volver a Plantillas
            </Link>
          )}
          {confirmDelete ? (
            <span className="ml-auto flex gap-2">
              <button type="button" onClick={remove} className={buttonDanger}>Sí, borrar</button>
              <button type="button" onClick={() => setConfirmDelete(false)} className={buttonSecondary}>No</button>
            </span>
          ) : (
            <button type="button" onClick={() => setConfirmDelete(true)} className={`${buttonDanger} ml-auto`}>Borrar</button>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="font-semibold">Vista previa</h2>
          <div>
            <label htmlFor="t-client" className="sr-only">Ver con los datos de</label>
            <select id="t-client" value={clientId} onChange={(e) => setClientId(e.target.value)} className={`${input} w-auto py-1 text-sm`}>
              <option value="">Con datos de ejemplo</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name || c.email}</option>)}
            </select>
          </div>
        </div>
        <FormError message={previewError} />
        <div className={`${panel} overflow-hidden`}>
          <p className="border-b border-line bg-paper px-4 py-2 text-sm">
            <span className="text-muted">Asunto:</span> <strong>{preview?.subject ?? "…"}</strong>
          </p>
          {/* sandbox sin permisos: el HTML de la plantilla no puede ejecutar
              scripts ni tocar el panel (no es del mismo origen). */}
          <iframe title="Vista previa del mail" sandbox="" srcDoc={preview?.html ?? ""} className="h-[32rem] w-full bg-white" />
        </div>
      </section>
    </div>
  );
}
