"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "../context/auth-context";
import { colors, spacing } from "../theme/tokens";

const LINKS = [
  { href: "/dashboard", label: "Operações" },
  { href: "/backoffice/merchants", label: "Merchants" },
  { href: "/backoffice/campaigns", label: "Campanhas" },
];

/** Shared top nav for every authenticated backoffice screen (operations dashboard + the merchants/experiences/campaigns/rooms CRUD screens added alongside it). */
export function Nav() {
  const pathname = usePathname();
  const { signOut } = useAuth();

  return (
    <header
      style={{
        backgroundColor: colors.navy,
        padding: `${spacing.md}px ${spacing.xl}px`,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: spacing.md,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: spacing.xl, flexWrap: "wrap" }}>
        <strong style={{ color: colors.white, fontSize: 16 }}>PassaSorte</strong>
        <nav style={{ display: "flex", gap: spacing.lg }}>
          {LINKS.map((link) => {
            const active = pathname === link.href || pathname?.startsWith(link.href + "/");
            return (
              <Link
                key={link.href}
                href={link.href}
                style={{
                  color: active ? colors.amber : colors.white,
                  fontWeight: active ? 700 : 400,
                  textDecoration: "none",
                  fontSize: 14,
                }}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <button
        onClick={() => void signOut()}
        style={{
          background: "transparent",
          border: `1px solid ${colors.white}`,
          color: colors.white,
          borderRadius: 999,
          padding: "6px 16px",
          fontSize: 13,
          cursor: "pointer",
        }}
      >
        Sair
      </button>
    </header>
  );
}
