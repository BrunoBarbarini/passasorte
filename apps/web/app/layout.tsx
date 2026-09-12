import type { ReactNode } from "react";
import { AuthProvider } from "../src/context/auth-context";

export const metadata = {
  title: "PassaSorte — Backoffice",
  description: "PassaSorte web / backoffice (ADR-007) — TASK-047 Game Operational Dashboard.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0 }}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
