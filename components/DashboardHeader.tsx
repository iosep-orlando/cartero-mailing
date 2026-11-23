"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useGlobal } from "@/lib/context/GlobalContext";
import { api } from "@/lib/fetcher";
import Logo from "./Logo";

export default function DashboardHeader() {
  const { me, refresh } = useGlobal();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function switchTo(tenantId: string) {
    setBusy(true);
    try {
      await api("/api/tenant/switch", { method: "POST", json: { tenantId } });
      await refresh();
      router.push("/dashboard");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  return (
    <header className="border-b border-line bg-white">
      <div className="mx-auto flex min-h-16 max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2">
        <Logo />
        {me?.tenant &&
          (me.tenants.length > 1 ? (
            <>
              <label htmlFor="org-switch" className="sr-only">Organización</label>
              <select
                id="org-switch"
                value={me.tenant.id}
                disabled={busy}
                onChange={(event) => switchTo(event.target.value)}
                className="rounded-md border border-line bg-white px-2 py-1 font-semibold"
              >
                {me.tenants.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </>
          ) : (
            <span className="font-semibold">{me.tenant.name}</span>
          ))}
        <div className="ml-auto flex items-center gap-3 text-sm">
          <span className="hidden text-muted sm:inline">{me?.user.email}</span>
          <button type="button" onClick={logout} className="rounded-md px-2 py-1 font-semibold text-muted hover:bg-paper hover:text-ink">
            Salir
          </button>
        </div>
      </div>
    </header>
  );
}
