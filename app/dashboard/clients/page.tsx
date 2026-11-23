import type { Metadata } from "next";
import ClientsManager from "@/components/ClientsManager";
import { pageTitle } from "@/components/ui";

export const metadata: Metadata = { title: "Clientes" };

export default function ClientsPage() {
  return (
    <main>
      <h1 className={pageTitle}>Clientes</h1>
      <ClientsManager />
    </main>
  );
}
