import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import TemplateEditor from "@/components/TemplateEditor";

export const metadata: Metadata = { title: "Editar plantilla" };

export default function EditTemplatePage({ params }: PageProps<"/dashboard/templates/[id]">) {
  return (
    <main>
      <Link href="/dashboard/templates" className="text-sm font-semibold text-muted hover:text-ink">← Plantillas</Link>
      <Suspense fallback={<p className="mt-6 text-muted">Cargando…</p>}>
        <Editor params={params} />
      </Suspense>
    </main>
  );
}

async function Editor({ params }: Pick<PageProps<"/dashboard/templates/[id]">, "params">) {
  const { id } = await params;
  return <TemplateEditor key={id} id={id} />;
}
