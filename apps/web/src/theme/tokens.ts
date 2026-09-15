/**
 * Web port of apps/mobile/src/theme/tokens.ts — same source (o PDF
 * PassaSorte_Design_System.pdf v1.0), same values, kept as a SEPARATE
 * file instead of a shared package because the two apps have different
 * build setups (Expo/RN vs Next.js) and the mobile file's values are
 * primitives (hex strings/numbers), trivial to duplicate faithfully
 * without extra shared-package plumbing for a first pass. If these ever
 * drift, apps/mobile/src/theme/tokens.ts is the source of truth (it
 * carries the full citation of which PDF page backs each value).
 */
export const colors = {
  navy: "#10162F",
  territory: "#2B2D70",
  violet: "#6D5DFB",
  coral: "#FF6B57",
  amber: "#FFB84D",
  aqua: "#2CC9B7",
  cream: "#FDF3EA",
  white: "#FFFFFF",
  danger: "#DC2626",
  textMuted: "#6B7280",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
  huge: 64,
} as const;

export const radius = {
  sm: 10,
  md: 16,
  lg: 24,
  pill: 999,
} as const;
