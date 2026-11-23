"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/fetcher";
import { formatDateTime } from "@/lib/format";
import { STARTER_TEMPLATE } from "@/lib/starter";
import type { TemplateDTO } from "@/lib/types";
import FormError from "./FormError";
import { button, panel } from "./ui";

export default function TemplatesList() {
  const router = useRouter();
  const [templates, setTemplates] = useState<TemplateDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api<{ templates: TemplateDTO[] }>("/api/templates")
      .then((data) => !cancelled && setTemplates(data.templates))
      .catch((err) => !cancelled && setError(errorMessage(err)));
    return () => {
      cancelled = true;
    };
  }, []);

  async function create() {
    setCreating(true);
    setError(null);
    try {
      const { template } = await api<{ template: TemplateDTO }>("/api/templates", { method: "POST", json: STARTER_TEMPLATE });
      router.push(`/dashboard/templates/${template.id}`);
    } catch (err) {
      setError(errorMessage(err));
      setCreating(false);
    }
  }

  return (
    <div className="mt-6 space-y-4">
      <button type="button" onClick={create} disabled={creating} className={button}>
        {creating ? "Creando…" : "Nueva plantilla"}
      </button>
      <FormError message={error} />
      {templates?.length === 0 && (
        <div className="rounded-lg border border-dashed border-line p-10 text-center text-muted">
          Todavía no hay plantillas. La nueva arranca con un ejemplo que ya usa variables.
        </div>
      )}
      {templates && templates.length > 0 && (
        <ul className={`${panel} divide-y divide-line`}>
          {templates.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 p-4">
              <div>
                <Link href={`/dashboard/templates/${t.id}`} className="font-semibold hover:underline">{t.name}</Link>
                <p className="text-sm text-muted">{t.subject}</p>
              </div>
              <span className="text-sm text-muted">Editada {formatDateTime(t.updatedAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
