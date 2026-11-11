/**
 * Canonical serialization + SHA-256 hash chain (BR-055, FR-077). Stable key
 * order, integers only (no floats), no undefined, no locale: the same
 * history always yields byte-identical text and therefore the same hashes.
 */
import { createHash } from "node:crypto";
import { GameEngineError } from "./errors.js";

export type CanonicalValue =
  | string
  | number
  | boolean
  | null
  | readonly CanonicalValue[]
  | { readonly [key: string]: CanonicalValue };

export function canonicalize(value: CanonicalValue): string {
  if (value === null) return "null";
  switch (typeof value) {
    case "string":
      return JSON.stringify(value);
    case "boolean":
      return value ? "true" : "false";
    case "number":
      if (!Number.isSafeInteger(value)) {
        throw new GameEngineError(
          "NON_CANONICAL_VALUE",
          "Valores numéricos do histórico do jogo devem ser inteiros.",
        );
      }
      return String(value);
    default:
      break;
  }
  if (Array.isArray(value)) {
    return `[${(value as readonly CanonicalValue[]).map(canonicalize).join(",")}]`;
  }
  const record = value as { readonly [key: string]: CanonicalValue };
  const entries = Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalize(record[key] as CanonicalValue)}`);
  return `{${entries.join(",")}}`;
}

export function sha256Hex(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/** hash(n) = sha256(hash(n-1) + "\n" + canonical(payload(n))). */
export function chainHash(previousHash: string, payload: CanonicalValue): string {
  return sha256Hex(`${previousHash}\n${canonicalize(payload)}`);
}
