import type { Metadata } from "next";
import TemplatesList from "@/components/TemplatesList";
import { pageTitle } from "@/components/ui";

export const metadata: Metadata = { title: "Plantillas" };

export default function TemplatesPage() {
  return (
    <main>
      <h1 className={pageTitle}>Plantillas</h1>
      <TemplatesList />
    </main>
  );
}
