import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Instrument Sans (licencia OFL) en el repo: compilar no depende de la red.
const instrument = localFont({
  src: "./fonts/instrument-sans-variable.woff2",
  variable: "--font-instrument",
  weight: "400 700",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Cartero", template: "%s · Cartero" },
  description: "Campañas de email para tu organización: clientes, plantillas y envíos.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-AR" className={`${instrument.variable} h-full antialiased`}>
      <body className="min-h-full bg-paper font-sans text-ink">{children}</body>
    </html>
  );
}
