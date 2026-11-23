"use client";

import { useState } from "react";
import { api, errorMessage } from "@/lib/fetcher";
import FormError from "./FormError";
import { button } from "./ui";

export default function UnsubscribeButton({
  token,
  already,
  organization,
}: {
  token: string;
  already: boolean;
  organization: string;
}) {
  const [done, setDone] = useState(already);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (done) {
    return (
      <p role="status" className="rounded-md border border-line bg-white p-4">
        Listo: ya no vas a recibir campañas de {organization}.
      </p>
    );
  }
  async function confirm() {
    setPending(true);
    setError(null);
    try {
      await api(`/api/unsubscribe/${token}`, { method: "POST" });
      setDone(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="space-y-3">
      <FormError message={error} />
      <button type="button" onClick={confirm} disabled={pending} className={button}>
        {pending ? "Un momento…" : "Confirmar la baja"}
      </button>
    </div>
  );
}
