import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import LoginForm from "@/components/LoginForm";
import { isOutbox } from "@/lib/mail";
import Logo from "@/components/Logo";

export const metadata: Metadata = { title: "Entrar" };

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <Logo href="/login" />
      <h1 className="display mt-8 text-3xl">Entrá con tu email</h1>
      <p className="mt-2 text-muted">Sin contraseña: te mandamos un enlace que vale 15 minutos.</p>
      {/* useSearchParams (?email= de las invitaciones) va en Suspense. */}
      <Suspense>
        <LoginFormForMode />
      </Suspense>
    </main>
  );
}

/** En la demo publicada (bandeja), el formulario lo explica y lleva a /bandeja. */
async function LoginFormForMode() {
  await connection(); // MAIL_TRANSPORT se lee al pedir la página, no al compilar
  return <LoginForm demo={isOutbox()} />;
}
