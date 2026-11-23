import type { Metadata } from "next";
import AttachmentsManager from "@/components/AttachmentsManager";
import { pageTitle } from "@/components/ui";

export const metadata: Metadata = { title: "Adjuntos" };

export default function AttachmentsPage() {
  return (
    <main>
      <h1 className={pageTitle}>Adjuntos</h1>
      <p className="mt-2 text-muted">Archivos para mandar con las campañas: un catálogo en PDF, una lista de precios. Hasta 5 MB cada uno.</p>
      <AttachmentsManager />
    </main>
  );
}
