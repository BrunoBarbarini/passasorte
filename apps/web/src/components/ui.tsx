"use client";

import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { colors, radius, spacing } from "../theme/tokens";

/**
 * Web port of the PassaSorte design system (apps/mobile/src/components,
 * same source: PassaSorte_Design_System.pdf v1.0). Mirrors the mobile
 * components' visual language 1:1 (pill buttons, soft-shadow cards,
 * brand-colored status pills) with plain inline styles, the same
 * pattern the mobile app uses (RN StyleSheet objects) - no CSS
 * framework was already present in apps/web (see package.json), so
 * this doesn't add one just for this pass.
 */

export function Card({ children, style }: { children: ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        borderRadius: radius.lg,
        backgroundColor: colors.white,
        padding: spacing.lg,
        boxShadow: "0 6px 16px rgba(16, 22, 47, 0.08)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

type ButtonVariant = "primary" | "secondary" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
}

/** p.13: "Participar" (sólido, coral) e "Ver experiência" (contorno, violeta). "danger" is this app's own addition (cancel/deactivate actions), kept outside the brand palette per the design system's own rule of never using red/green for game meaning. */
export function Button({ variant = "primary", loading, disabled, style, children, ...rest }: ButtonProps) {
  const isPrimary = variant === "primary";
  const isDanger = variant === "danger";
  const base: React.CSSProperties = {
    borderRadius: radius.pill,
    padding: `${spacing.md}px ${spacing.xl}px`,
    fontSize: 15,
    fontWeight: 700,
    border: "none",
    cursor: disabled || loading ? "not-allowed" : "pointer",
    opacity: disabled || loading ? 0.5 : 1,
  };
  if (isPrimary) {
    Object.assign(base, { backgroundColor: colors.coral, color: colors.white });
  } else if (isDanger) {
    Object.assign(base, { backgroundColor: colors.danger, color: colors.white });
  } else {
    Object.assign(base, {
      backgroundColor: "transparent",
      color: colors.violet,
      border: `2px solid ${colors.violet}`,
    });
  }
  return (
    <button {...rest} disabled={disabled || loading} style={{ ...base, ...style }}>
      {loading ? "..." : children}
    </button>
  );
}

export function LinkButton({
  variant = "secondary",
  children,
  style,
  ...rest
}: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; variant?: ButtonVariant }) {
  const isPrimary = variant === "primary";
  const base: React.CSSProperties = {
    display: "inline-block",
    borderRadius: radius.pill,
    padding: `${spacing.sm}px ${spacing.lg}px`,
    fontSize: 14,
    fontWeight: 700,
    textDecoration: "none",
    backgroundColor: isPrimary ? colors.coral : "transparent",
    color: isPrimary ? colors.white : colors.violet,
    border: isPrimary ? "none" : `2px solid ${colors.violet}`,
  };
  return (
    <Link {...rest} style={{ ...base, ...style }}>
      {children}
    </Link>
  );
}

const TONE_COLOR: Record<string, string> = {
  ACTIVE: colors.aqua,
  PUBLISHED: colors.aqua,
  SCHEDULED: colors.violet,
  APPROVED: colors.violet,
  IN_REVIEW: colors.amber,
  DRAFT: colors.textMuted,
  RUNNING: colors.coral,
  ENTRY_LOCKED: colors.amber,
  OPEN: colors.aqua,
  FINAL_LOCK: colors.coral,
  RESOLVING: colors.amber,
  COMPLETED: colors.aqua,
  ENDED: colors.textMuted,
  INACTIVE: colors.textMuted,
  ARCHIVED: colors.textMuted,
  CANCELLED: colors.danger,
};

/** Colors any status string the API already returns (room/campaign/merchant/experience) using the design system's palette (p.6/p.11) - never invents a new status, just a color for one that exists. */
export function StatusPill({ status }: { status: string }) {
  const color = TONE_COLOR[status] ?? colors.textMuted;
  return (
    <span
      style={{
        display: "inline-block",
        borderRadius: radius.pill,
        padding: `${spacing.xs}px ${spacing.md}px`,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: 0.5,
        textTransform: "uppercase",
        color: colors.white,
        backgroundColor: color,
      }}
    >
      {status}
    </span>
  );
}

const fieldStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: spacing.md,
  borderRadius: radius.sm,
  border: "1px solid #E5DED3",
  fontSize: 15,
  fontFamily: "inherit",
  color: colors.navy,
  backgroundColor: colors.white,
};

export function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: spacing.lg }}>
      <label htmlFor={htmlFor} style={{ display: "block", marginBottom: spacing.xs, fontSize: 13, fontWeight: 600, color: colors.territory }}>
        {label}
      </label>
      {children}
    </div>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} style={{ ...fieldStyle, ...props.style }} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} style={{ ...fieldStyle, minHeight: 90, ...props.style }} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} style={{ ...fieldStyle, ...props.style }} />;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        flexWrap: "wrap",
        gap: spacing.md,
        marginBottom: spacing.xl,
      }}
    >
      <div>
        <h1 style={{ fontSize: 28, fontWeight: 700 }}>{title}</h1>
        {subtitle && <p style={{ color: colors.textMuted, margin: 0 }}>{subtitle}</p>}
      </div>
      {actions && <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>{actions}</div>}
    </div>
  );
}

export function EmptyState({ label }: { label: string }) {
  return <p style={{ color: colors.textMuted, fontStyle: "italic" }}>{label}</p>;
}

export function Banner({ tone = "info", children }: { tone?: "info" | "error"; children: ReactNode }) {
  return (
    <div
      style={{
        borderRadius: radius.sm,
        padding: spacing.md,
        marginBottom: spacing.lg,
        backgroundColor: tone === "error" ? "#FDEDEC" : "#EFF0FA",
        color: tone === "error" ? colors.danger : colors.territory,
        fontSize: 14,
      }}
    >
      {children}
    </div>
  );
}
