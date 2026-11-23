import type { Metadata } from "next";
import SettingsPanel from "@/components/SettingsPanel";
import { pageTitle } from "@/components/ui";

export const metadata: Metadata = { title: "Organización" };

export default function SettingsPage() {
  return (
    <main>
      <h1 className={pageTitle}>Organización</h1>
      <SettingsPanel />
    </main>
  );
}
