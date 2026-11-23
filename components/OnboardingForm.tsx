"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api, errorMessage } from "@/lib/fetcher";
import FormError from "./FormError";
import { button, input, label } from "./ui";

export default function OnboardingForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await api("/api/tenant", { method: "POST", json: { name } });
      router.replace("/dashboard");
    } catch (err) {
      setError(errorMessage(err));
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-4">
      <div>
        <label htmlFor="org" className={label}>Nombre de la organización</label>
        <input id="org" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej.: Librería Rayuela" className={input} />
      </div>
      <FormError message={error} />
      <button type="submit" disabled={pending} className={`${button} w-full`}>
        {pending ? "Creando…" : "Crear y empezar"}
      </button>
    </form>
  );
}
