import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ClimaGest · Partes de trabajo",
  description: "Aplicación para gestionar partes de trabajo y el historial de equipos.",
  referrer: "no-referrer",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  );
}
