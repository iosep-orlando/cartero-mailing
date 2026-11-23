"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useGlobal } from "@/lib/context/GlobalContext";
import { api, errorMessage } from "@/lib/fetcher";
import type { InvitationDTO, MemberDTO } from "@/lib/types";
import FormError from "./FormError";
import { button, input, label, linkButton, panel } from "./ui";

export default function SettingsPanel() {
  const { me, refresh } = useGlobal();
  const [members, setMembers] = useState<MemberDTO[]>([]);
  const [invitations, setInvitations] = useState<InvitationDTO[]>([]);
  const [name, setName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isOwner = me?.tenant?.role === "owner";

  const load = useCallback(async () => {
    try {
      const data = await api<{ members: MemberDTO[]; invitations: InvitationDTO[] }>("/api/tenant/members");
      setMembers(data.members);
      setInvitations(data.invitations);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);
  useEffect(() => {
    if (me?.tenant) {
      const timer = setTimeout(() => setName(me.tenant!.name), 0);
      return () => clearTimeout(timer);
    }
  }, [me?.tenant]);

  async function act(fn: () => Promise<unknown>, done: string) {
    setError(null);
    setNotice(null);
    try {
      await fn();
      setNotice(done);
      await Promise.all([load(), refresh()]);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  function rename(event: FormEvent) {
    event.preventDefault();
    void act(() => api("/api/tenant", { method: "PATCH", json: { name } }), "Nombre guardado.");
  }

  function invite(event: FormEvent) {
    event.preventDefault();
    void act(async () => {
      const { joined } = await api<{ joined: boolean }>("/api/tenant/invitations", { method: "POST", json: { email: inviteEmail } });
      setInviteEmail("");
      return joined;
    }, "Invitación enviada por mail.");
  }

  if (!me?.tenant) return <p className="mt-6 text-muted">Cargando…</p>;

  return (
    <div className="mt-6 space-y-6">
      <FormError message={error} />
      {notice && <p role="status" className="text-sm text-correo">{notice}</p>}

      <form onSubmit={rename} className={`${panel} flex flex-wrap items-end gap-3 p-5`}>
        <div className="min-w-56 flex-1">
          <label htmlFor="org-name" className={label}>Nombre (es el remitente que ven tus clientes)</label>
          <input id="org-name" value={name} onChange={(e) => setName(e.target.value)} disabled={!isOwner} maxLength={80} className={input} />
        </div>
        {isOwner && <button type="submit" className={button}>Guardar</button>}
      </form>

      <section className={`${panel} p-5`}>
        <h2 className="font-semibold">Equipo</h2>
        <ul className="mt-3 divide-y divide-line">
          {members.map((m) => (
            <li key={m.userId} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <div>
                <p className="font-semibold">{m.email}</p>
                <p className="text-sm text-muted">{m.role === "owner" ? "Dueño" : "Miembro"}</p>
              </div>
              {isOwner && m.role !== "owner" && (
                <button type="button" onClick={() => act(() => api(`/api/tenant/members/${m.userId}`, { method: "DELETE" }), "Miembro quitado.")} className={`${linkButton} text-muted hover:text-sello`}>
                  Quitar
                </button>
              )}
            </li>
          ))}
          {invitations.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <div>
                <p className="font-semibold">{i.email}</p>
                <p className="text-sm text-muted">Invitación pendiente: entra cuando ingrese con ese email</p>
              </div>
              {isOwner && (
                <button type="button" onClick={() => act(() => api(`/api/tenant/invitations/${i.id}`, { method: "DELETE" }), "Invitación cancelada.")} className={`${linkButton} text-muted hover:text-sello`}>
                  Cancelar
                </button>
              )}
            </li>
          ))}
        </ul>
        {isOwner ? (
          <form onSubmit={invite} className="mt-4 flex flex-wrap items-end gap-3">
            <div className="min-w-56 flex-1">
              <label htmlFor="invite" className={label}>Invitar por email</label>
              <input id="invite" type="email" required value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} className={input} />
            </div>
            <button type="submit" className={button}>Invitar</button>
          </form>
        ) : (
          <p className="mt-3 text-sm text-muted">Solo el dueño invita o quita miembros.</p>
        )}
      </section>

      <section className={`${panel} p-5`}>
        <h2 className="font-semibold">Tus organizaciones</h2>
        <p className="mt-1 text-sm text-muted">
          Cada organización tiene sus propios clientes, plantillas y campañas: nadie de una ve los datos de otra.
          Se cambia de una a otra arriba, al lado del logo.
        </p>
        <ul className="mt-3 list-disc pl-5 text-sm">
          {me.tenants.map((t) => (
            <li key={t.id}>{t.name}{t.id === me.tenant!.id && " (esta)"} · {t.role === "owner" ? "dueño" : "miembro"}</li>
          ))}
        </ul>
        <Link href="/onboarding" className={`${linkButton} mt-3 inline-block text-sm`}>Crear otra organización</Link>
      </section>
    </div>
  );
}
