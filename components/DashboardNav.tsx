"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/dashboard", label: "Resumen" },
  { href: "/dashboard/campaigns", label: "Campañas" },
  { href: "/dashboard/clients", label: "Clientes" },
  { href: "/dashboard/templates", label: "Plantillas" },
  { href: "/dashboard/attachments", label: "Adjuntos" },
  { href: "/dashboard/settings", label: "Organización" },
];

export default function DashboardNav() {
  return <DashboardNavLinks pathname={usePathname()} />;
}

export function DashboardNavLinks({ pathname }: { pathname: string | null }) {
  return (
    <nav aria-label="Panel" className="flex gap-1 overflow-x-auto md:flex-col">
      {LINKS.map(({ href, label }) => {
        const active = pathname !== null && (href === "/dashboard" ? pathname === href : pathname.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap rounded-md px-3 py-2 text-sm font-semibold ${
              active ? "bg-correo text-white" : "hover:bg-white"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
