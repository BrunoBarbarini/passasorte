/**
 * Phase 9 (Pilot Launch): CLAUDE.md describes this phase only in prose —
 * "controlled merchants, limited rooms, strong monitoring and daily
 * product review" — with no numbered backlog task (TASK-001..070 already
 * cover Phases 0-8). This module is the technical half of that: an
 * operational gate that restricts WHICH merchants can go live and HOW
 * MANY rooms can be active at once, while the pilot is running.
 *
 * This is deliberately modeled as operational/infrastructure
 * configuration, not a business rule about the game itself — the same
 * category as CORS_ALLOWED_ORIGINS or RATE_LIMIT_MAX (CLAUDE.md #42:
 * env-driven config is fine for infra/operational pacing, never for
 * business constants). It never touches movement, Sorte, winner
 * selection, pricing, or any other TBD business rule (CLAUDE.md #56/#58)
 * — it only decides whether an already-valid campaign/room operation is
 * allowed to proceed *right now, during the pilot*.
 *
 * `enabled: false` (the default, matching every other kill switch in
 * CLAUDE.md #22) must be a complete no-op — every predicate here returns
 * `true` unconditionally when the policy is disabled, so a deployment
 * that never turns pilot mode on is byte-for-byte unaffected by this
 * module's existence.
 */

/** Room statuses that count as "active" for the pilot's room-count cap. */
export const PILOT_ACTIVE_ROOM_STATUSES = [
  "OPEN",
  "ENTRY_LOCKED",
  "RUNNING",
  "FINAL_LOCK",
  "RESOLVING",
] as const;

export interface PilotPolicy {
  /** Master switch. false = every check below is a no-op. */
  readonly enabled: boolean;
  /**
   * Merchant ids allowed to publish campaigns / open rooms while the
   * pilot is enabled. Never defaulted to "all merchants" implicitly —
   * an empty list with `enabled: true` means no merchant is allowed yet,
   * which is the safe failure mode for a pilot that hasn't been
   * explicitly configured.
   */
  readonly allowedMerchantIds: readonly string[];
  /**
   * Maximum number of simultaneously active rooms (see
   * PILOT_ACTIVE_ROOM_STATUSES) platform-wide while the pilot is
   * enabled. `null` means no cap — CLAUDE.md #58 forbids inventing a
   * numeric limit that nobody configured.
   */
  readonly maxActiveRooms: number | null;
}

/** The safe, inert default — identical behavior to not having this module at all. */
export const PILOT_DISABLED_POLICY: PilotPolicy = {
  enabled: false,
  allowedMerchantIds: [],
  maxActiveRooms: null,
};

/**
 * Whether `merchantId` may operate (publish a campaign, open a room)
 * under the current pilot policy. Always true when the pilot is off.
 */
export function isMerchantAllowedInPilot(policy: PilotPolicy, merchantId: string): boolean {
  if (!policy.enabled) return true;
  return policy.allowedMerchantIds.includes(merchantId);
}

/**
 * Whether one more room may become active given `currentActiveRoomCount`
 * already-active rooms. Always true when the pilot is off or has no cap
 * configured.
 */
export function hasActiveRoomCapacity(policy: PilotPolicy, currentActiveRoomCount: number): boolean {
  if (!policy.enabled || policy.maxActiveRooms === null) return true;
  return currentActiveRoomCount < policy.maxActiveRooms;
}
