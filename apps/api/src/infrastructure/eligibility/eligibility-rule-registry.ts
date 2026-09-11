import type { EligibilityRule } from "@passasorte/domain";

/**
 * FR-028/FR-029: eligibility rules are code, not data (CLAUDE.md #58 —
 * concrete eligibility criteria are TBD and must never be invented).
 * A room stores only rule IDs; this registry is the single place a real
 * rule gets wired in once one is actually decided. It is intentionally
 * EMPTY today — every room's participationPackages resolve to zero
 * eligibility rules until this registry gains an entry, which is exactly
 * the "zero rules is the correct default" behavior
 * evaluateEligibility() already documents in @passasorte/domain.
 */
const ELIGIBILITY_RULE_REGISTRY: Readonly<Record<string, EligibilityRule>> = {};

/** Resolves rule ids to their implementations; unknown ids are silently dropped. */
export function resolveEligibilityRules(ruleIds: readonly string[]): EligibilityRule[] {
  return ruleIds
    .map((id) => ELIGIBILITY_RULE_REGISTRY[id])
    .filter((rule): rule is EligibilityRule => rule !== undefined);
}
