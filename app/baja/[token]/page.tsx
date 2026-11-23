import type { Metadata } from "next";
import { Suspense } from "react";
import UnsubscribeButton from "@/components/UnsubscribeButton";
import { describeDelivery } from "@/lib/store/tracking";
import { verifyToken } from "@/lib/tracking";

export const metadata: Metadata = { title: "Darse de baja", robots: { index: false } };

export default function UnsubscribePage({ params }: PageProps<"/baja/[token]">) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <Suspense fallback={<p className="text-muted">Cargando…</p>}>
        <Unsubscribe params={params} />
      </Suspense>
    </main>
  );
}

async function Unsubscribe({ params }: Pick<PageProps<"/baja/[token]">, "params">) {
  const { token } = await params;
  const deliveryId = verifyToken("unsubscribe", token);
  const info = deliveryId ? await describeDelivery(deliveryId) : null;
  if (!info) {
    return (
      <>
        <h1 className="display text-3xl">Enlace inválido</h1>
        <p className="mt-2 text-muted">Usá el enlace «Darte de baja» tal como llegó en el mail.</p>
      </>
    );
  }
  return (
    <>
      <h1 className="display text-3xl">Darte de baja</h1>
      <p className="mt-2 text-muted">
        {info.email} dejará de recibir mails de <strong className="text-ink">{info.organization}</strong>.
      </p>
      <div className="mt-6">
        <UnsubscribeButton token={token} already={info.unsubscribed} organization={info.organization} />
      </div>
    </>
  );
}
