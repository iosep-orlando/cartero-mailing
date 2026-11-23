import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import CampaignDetail from "@/components/CampaignDetail";

export const metadata: Metadata = { title: "Campaña" };

export default function CampaignPage({ params }: PageProps<"/dashboard/campaigns/[id]">) {
  return (
    <main>
      <Link href="/dashboard/campaigns" className="text-sm font-semibold text-muted hover:text-ink">← Campañas</Link>
      <Suspense fallback={<p className="mt-6 text-muted">Cargando…</p>}>
        <Detail params={params} />
      </Suspense>
    </main>
  );
}

async function Detail({ params }: Pick<PageProps<"/dashboard/campaigns/[id]">, "params">) {
  const { id } = await params;
  return <CampaignDetail key={id} id={id} />;
}
