"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, errorMessage } from "@/lib/fetcher";
import { formatNumber } from "@/lib/format";
import type { ClientDTO } from "@/lib/types";
import FormError from "./FormError";
import { button, buttonSecondary, input, label, linkButton, panel } from "./ui";

interface ListResponse {
  clients: ClientDTO[];
  total: number;
  tags: string[];
}

interface ImportResponse {
  created: number;
  updated: number;
  errors: { line: number; error: string }[];
  errorCount: number;
}

const EMPTY = { email: "", name: "", tags: "" };

export default function ClientsManager() {
  const [data, setData] = useState<ListResponse | null>(null);
  const [q, setQ] = useState("");
  const [tag, setTag] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState<"form" | "import" | null>(null);
  const [editing, setEditing] = useState<ClientDTO | null>(null);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (tag) params.set("tag", tag);
      setData(await api<ListResponse>(`/api/clients?${params}`));
      setLoadError(null);
    } catch (err) {
      setLoadError(errorMessage(err));
    }
  }, [q, tag]);

  // Se carga al mostrarse (también al volver a la pantalla) y al filtrar,
  // con una pausa corta mientras se escribe en la búsqueda.
  useEffect(() => {
    const timer = setTimeout(() => void load(), q ? 250 : 0);
    return () => clearTimeout(timer);
  }, [load, q]);

  function openForm(client: ClientDTO | null) {
    setEditing(client);
    setPanelOpen("form");
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-48 flex-1">
          <label htmlFor="q" className="sr-only">Buscar</label>
          <input id="q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o email" className={input} />
        </div>
        <div>
          <label htmlFor="tag" className="sr-only">Etiqueta</label>
          <select id="tag" value={tag} onChange={(e) => setTag(e.target.value)} className={`${input} w-auto`}>
            <option value="">Todas las etiquetas</option>
            {data?.tags.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <button type="button" onClick={() => openForm(null)} className={button}>Agregar cliente</button>
        <button type="button" onClick={() => setPanelOpen(panelOpen === "import" ? null : "import")} className={buttonSecondary}>
          Importar CSV
        </button>
      </div>

      {panelOpen === "form" && (
        <ClientForm
          key={editing?.id ?? "new"}
          client={editing}
          onDone={() => {
            setPanelOpen(null);
            void load();
          }}
          onCancel={() => setPanelOpen(null)}
        />
      )}
      {panelOpen === "import" && <ImportPanel onImported={load} onClose={() => setPanelOpen(null)} />}

      <FormError message={loadError} />
      {data && (
        <p className="text-sm text-muted" aria-live="polite">
          {data.total === 1 ? "1 cliente" : `${formatNumber(data.total)} clientes`}
          {data.total > data.clients.length && ` (se muestran ${data.clients.length})`}
        </p>
      )}
      {data && data.clients.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line p-10 text-center text-muted">
          {q || tag ? "Nadie coincide con ese filtro." : "Todavía no hay clientes. Agregalos a mano o importá un CSV."}
        </div>
      ) : (
        data && (
          <div className={`${panel} overflow-x-auto`}>
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="border-b border-line text-muted">
                <tr>
                  <th className="p-3 font-semibold">Cliente</th>
                  <th className="p-3 font-semibold">Etiquetas</th>
                  <th className="p-3 font-semibold">Estado</th>
                  <th className="p-3"><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.clients.map((client) => (
                  <ClientRow key={client.id} client={client} onEdit={() => openForm(client)} onDeleted={load} />
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
}

function ClientRow({ client, onEdit, onDeleted }: { client: ClientDTO; onEdit: () => void; onDeleted: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function remove() {
    try {
      await api(`/api/clients/${client.id}`, { method: "DELETE" });
      onDeleted();
    } catch (err) {
      setError(errorMessage(err));
    }
  }
  return (
    <tr className={client.unsubscribed || client.bounced ? "text-muted" : ""}>
      <td className="p-3">
        <p className="font-semibold">{client.name || "—"}</p>
        <p className="text-muted">{client.email}</p>
      </td>
      <td className="p-3">
        <div className="flex flex-wrap gap-1">
          {client.tags.map((t) => (
            <span key={t} className="rounded bg-paper px-1.5 py-0.5 text-xs font-semibold">{t}</span>
          ))}
        </div>
      </td>
      <td className="p-3">
        {client.unsubscribed ? (
          "Dado de baja"
        ) : client.bounced ? (
          <>
            <span className="font-semibold text-sello">Rebotó</span>
            <p className="max-w-56 text-xs text-muted">{client.bounceReason}. Corregí el email para volver a mandarle.</p>
          </>
        ) : (
          "Suscrito"
        )}
      </td>
      <td className="p-3 text-right whitespace-nowrap">
        {error && <span className="mr-2 text-sello">{error}</span>}
        {confirming ? (
          <>
            <button type="button" onClick={remove} className="font-semibold text-sello hover:underline">Sí, borrar</button>
            <button type="button" onClick={() => setConfirming(false)} className="ml-3 text-muted">No</button>
          </>
        ) : (
          <>
            <button type="button" onClick={onEdit} className={linkButton}>Editar</button>
            <button type="button" onClick={() => setConfirming(true)} className="ml-3 font-semibold text-muted hover:text-sello">Borrar</button>
          </>
        )}
      </td>
    </tr>
  );
}

function ClientForm({ client, onDone, onCancel }: { client: ClientDTO | null; onDone: () => void; onCancel: () => void }) {
  const [form, setForm] = useState(
    client ? { email: client.email, name: client.name, tags: client.tags.join(", ") } : EMPTY,
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (key: keyof typeof EMPTY) => (event: { target: { value: string } }) =>
    setForm({ ...form, [key]: event.target.value });

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await api(client ? `/api/clients/${client.id}` : "/api/clients", { method: client ? "PATCH" : "POST", json: form });
      onDone();
    } catch (err) {
      setError(errorMessage(err));
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className={`${panel} grid gap-4 p-5 sm:grid-cols-3`}>
      <h2 className="font-semibold sm:col-span-3">{client ? "Editar cliente" : "Nuevo cliente"}</h2>
      <div>
        <label htmlFor="c-email" className={label}>Email</label>
        <input id="c-email" type="email" required value={form.email} onChange={set("email")} className={input} />
      </div>
      <div>
        <label htmlFor="c-name" className={label}>Nombre</label>
        <input id="c-name" maxLength={120} value={form.name} onChange={set("name")} className={input} />
      </div>
      <div>
        <label htmlFor="c-tags" className={label}>Etiquetas</label>
        <input id="c-tags" value={form.tags} onChange={set("tags")} placeholder="vip, norte" className={input} />
      </div>
      <div className="sm:col-span-3">
        <FormError message={error} />
      </div>
      <div className="flex gap-3 sm:col-span-3">
        <button type="submit" disabled={pending} className={button}>{pending ? "Guardando…" : "Guardar"}</button>
        <button type="button" onClick={onCancel} className={buttonSecondary}>Cancelar</button>
      </div>
    </form>
  );
}

function ImportPanel({ onImported, onClose }: { onImported: () => void; onClose: () => void }) {
  const [result, setResult] = useState<ImportResponse | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File | undefined) {
    if (!file) return;
    setPending(true);
    setError(null);
    setResult(null);
    try {
      const csv = await file.text();
      setResult(await api<ImportResponse>("/api/clients/import", { method: "POST", json: { csv } }));
      onImported();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <section className={`${panel} space-y-3 p-5`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Importar desde CSV</h2>
          <p className="mt-1 text-sm text-muted">
            Primera fila con los títulos <code>email</code>, <code>nombre</code> y <code>etiquetas</code> (las
            etiquetas separadas por punto y coma o coma, entre comillas). Sirve el CSV que guarda Excel. Si un email
            ya existe, se actualiza; si se había dado de baja, sigue de baja.
          </p>
        </div>
        <button type="button" onClick={onClose} className="text-sm font-semibold text-muted">Cerrar</button>
      </div>
      <input type="file" accept=".csv,text/csv" disabled={pending} onChange={(e) => upload(e.target.files?.[0])} className="block text-sm" />
      {pending && <p className="text-sm text-muted">Importando…</p>}
      <FormError message={error} />
      {result && (
        <div role="status" className="rounded-md bg-paper p-3 text-sm">
          <p>
            <strong>{result.created}</strong> nuevos, <strong>{result.updated}</strong> actualizados
            {result.errorCount > 0 && <>, <strong className="text-sello">{result.errorCount}</strong> filas con errores</>}.
          </p>
          {result.errors.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-sello">
              {result.errors.map((e) => <li key={e.line}>Fila {e.line}: {e.error}</li>)}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
