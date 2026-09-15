import type { ReactNode } from "react";
import { AuthProvider } from "../src/context/auth-context";
import "./globals.css";

export const metadata = {
  title: "PassaSorte — Backoffice",
  description: "PassaSorte web / backoffice (ADR-007) — dashboard operacional + gestão de merchants/experiences/campaigns/rooms.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
