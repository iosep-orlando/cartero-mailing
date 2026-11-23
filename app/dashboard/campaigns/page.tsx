import type { Metadata } from "next";
import CampaignsList from "@/components/CampaignsList";
import { pageTitle } from "@/components/ui";

export const metadata: Metadata = { title: "Campañas" };

export default function CampaignsPage() {
  return (
    <main>
      <h1 className={pageTitle}>Campañas</h1>
      <CampaignsList />
    </main>
  );
}
