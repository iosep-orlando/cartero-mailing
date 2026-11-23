"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MAX_ATTACHMENT_BYTES, formatBytes } from "@/lib/attachments";
import { api, errorMessage } from "@/lib/fetcher";
import { formatDateTime } from "@/lib/format";
import type { AttachmentDTO } from "@/lib/types";
import FormError from "./FormError";
import { button, linkButton, panel } from "./ui";

export default function AttachmentsManager() {
  const [list, setList] = useState<AttachmentDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      setList((await api<{ attachments: AttachmentDTO[] }>("/api/attachments")).attachments);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  async function upload(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (file.size > MAX_ATTACHMENT_BYTES) {
      setError("El archivo pesa más de 5 MB.");
      return;
    }
    setUploading(true);
    try {
      await api("/api/attachments", {
        method: "POST",
        headers: { "x-filename": encodeURIComponent(file.name), "content-type": "application/octet-stream" },
        body: file,
      });
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function remove(id: string) {
    setError(null);
    try {
      await api(`/api/attachments/${id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div className="mt-6 space-y-4">
      <input ref={fileInput} type="file" onChange={(e) => upload(e.target.files?.[0])} className="sr-only" tabIndex={-1} aria-hidden />
      <button type="button" onClick={() => fileInput.current?.click()} disabled={uploading} className={button}>
        {uploading ? "Subiendo…" : "Subir un archivo"}
      </button>
      <FormError message={error} />
      {list?.length === 0 && <p className="text-muted">Todavía no subiste ningún archivo.</p>}
      {list && list.length > 0 && (
        <ul className={`${panel} divide-y divide-line`}>
          {list.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 p-4">
              <div>
                <a href={`/api/attachments/${a.id}`} className="font-semibold hover:underline">{a.filename}</a>
                <p className="text-sm text-muted">{formatBytes(a.size)} · {formatDateTime(a.createdAt)}</p>
              </div>
              <button type="button" onClick={() => remove(a.id)} className={`${linkButton} text-muted hover:text-sello`}>Borrar</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
