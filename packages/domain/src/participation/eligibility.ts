/**
 * Eligibility (FR-028: server-side validation). WHAT the concrete rules
 * are — minimum age, per-user participation limits, KYC, region
 * restrictions, etc. — is explicitly TBD (CLAUDE.md #58 forbids
 * inventing "eligibility/minimum age"; CLAUDE.md #56 Product - HIGH also
 * lists "participation limits" as open). This module only defines the
 * pluggable seam: a list of configured rules is evaluated server-side,
 * with zero rules configured by default (never a built-in default rule).
 */
export interface EligibilityContext {
  readonly userId: string;
  readonly roomId: string;
  readonly requestedPositionCount: number;
  /** How many non-terminal participations this user already has in this room, if that ever matters to a configured rule. */
  readonly existingActiveParticipationCount: number;
}

export interface EligibilityViolation {
  readonly ruleId: string;
  readonly message: string;
}

export interface EligibilityRule {
  readonly id: string;
  /** Returns a violation when the context fails this rule, or null when it passes. */
  evaluate(context: EligibilityContext): EligibilityViolation | null;
}

/** Runs every configured rule; an empty `rules` list is valid (no rules decided yet). */
export function evaluateEligibility(
  rules: readonly EligibilityRule[],
  context: EligibilityContext,
): readonly EligibilityViolation[] {
  const violations: EligibilityViolation[] = [];
  for (const rule of rules) {
    const violation = rule.evaluate(context);
    if (violation) {
      violations.push(violation);
    }
  }
  return violations;
}

export function isEligible(
  rules: readonly EligibilityRule[],
  context: EligibilityContext,
): boolean {
  return evaluateEligibility(rules, context).length === 0;
}
