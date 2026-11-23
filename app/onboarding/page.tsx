import type { Metadata } from "next";
import Logo from "@/components/Logo";
import OnboardingForm from "@/components/OnboardingForm";

export const metadata: Metadata = { title: "Tu organización" };

export default function OnboardingPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <Logo href="/onboarding" />
      <h1 className="display mt-8 text-3xl">¿Cómo se llama tu organización?</h1>
      <p className="mt-2 text-muted">
        Es el nombre que ven tus clientes como remitente. Después podés invitar a tu equipo.
      </p>
      <OnboardingForm />
      <p className="mt-6 text-sm text-muted">
        ¿Te invitaron a una que ya existe? Pedile a quien te invitó que te agregue con este mismo email y volvé a
        entrar.
      </p>
    </main>
  );
}
