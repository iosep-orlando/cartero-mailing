import { Suspense } from "react";
import DashboardHeader from "@/components/DashboardHeader";
import DashboardNav, { DashboardNavLinks } from "@/components/DashboardNav";
import { GlobalProvider } from "@/lib/context/GlobalContext";

// El panel privado de la organización. proxy.ts ya exige sesión con
// organización; las rutas de la API lo vuelven a comprobar contra la base.
export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    <GlobalProvider>
      <DashboardHeader />
      <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-6 md:grid-cols-[11rem_1fr]">
        {/* usePathname depende de la URL: en Suspense, con los enlaces sin resaltar mientras tanto. */}
        <Suspense fallback={<DashboardNavLinks pathname={null} />}>
          <DashboardNav />
        </Suspense>
        <div className="min-w-0">{children}</div>
      </div>
    </GlobalProvider>
  );
}
