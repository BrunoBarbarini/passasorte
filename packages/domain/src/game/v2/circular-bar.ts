/**
 * Circular bar (DECISION-01, BR-022): positions are 1..N, the bar wraps in
 * both directions (N + RIGHT -> 1, 1 + LEFT -> N) and every movement credit
 * displaces the Sorte by exactly one position. CLAMP / REJECT / BOUNCE do
 * not exist. Pure: no clock, no randomness, no I/O (NFR-017).
 */
import { GameEngineError } from "./errors.js";
import type { SorteDirection } from "./types.js";

export function assertValidBarSize(size: number): void {
  if (!Number.isSafeInteger(size) || size < 1) {
    throw new GameEngineError(
      "INVALID_BAR_SIZE",
      "O tamanho da barra deve ser um inteiro maior ou igual a 1.",
    );
  }
}

export function assertValidPosition(position: number, size: number): void {
  assertValidBarSize(size);
  if (!Number.isSafeInteger(position) || position < 1 || position > size) {
    throw new GameEngineError(
      "INVALID_POSITION",
      `A posição deve ser um inteiro entre 1 e ${size}.`,
    );
  }
}

function mod(value: number, modulus: number): number {
  return ((value % modulus) + modulus) % modulus;
}

/**
 * Position of the Sorte after spending `credits` movement credits in
 * `direction`. STAY never displaces. `credits` >= `size` is allowed (a full
 * lap is no net displacement).
 */
export function displaceSorte(
  position: number,
  direction: SorteDirection,
  credits: number,
  size: number,
): number {
  assertValidPosition(position, size);
  if (!Number.isSafeInteger(credits) || credits < 0) {
    throw new GameEngineError(
      "INVALID_CREDITS",
      "A quantidade de créditos deve ser um inteiro não negativo.",
    );
  }
  if (direction === "STAY") return position;
  const delta = direction === "RIGHT" ? credits : -credits;
  return mod(position - 1 + delta, size) + 1;
}

/** Shortest distance between two positions on the circular bar (BR-014). */
export function circularDistance(a: number, b: number, size: number): number {
  assertValidPosition(a, size);
  assertValidPosition(b, size);
  const direct = Math.abs(a - b);
  return Math.min(direct, size - direct);
}
