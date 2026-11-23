import type { Metadata } from "next";
import Link from "next/link";
import CampaignForm from "@/components/CampaignForm";
import { pageTitle } from "@/components/ui";

export const metadata: Metadata = { title: "Nueva campaña" };

export default function NewCampaignPage() {
  return (
    <main>
      <Link href="/dashboard/campaigns" className="text-sm font-semibold text-muted hover:text-ink">← Campañas</Link>
      <h1 className={`${pageTitle} mt-2`}>Nueva campaña</h1>
      <CampaignForm />
    </main>
  );
}
