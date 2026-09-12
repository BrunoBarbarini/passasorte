import type { EligibilityRule } from "@passasorte/domain";

/**
 * Mirrors apps/api/src/infrastructure/eligibility/eligibility-rule-registry.ts
 * exactly (same empty-registry pattern, CLAUDE.md #58: eligibility rules
 * TBD; unknown ids are silently dropped, never invented). The worker
 * never CREATES rooms, but reading a persisted GameRoom still needs to
 * resolve stored eligibilityRuleIds back into the domain's
 * ParticipationPackage shape.
 */
const ELIGIBILITY_RULE_REGISTRY: Readonly<Record<string, EligibilityRule>> = {};

export function resolveEligibilityRules(ruleIds: readonly string[]): EligibilityRule[] {
  return ruleIds
    .map((id) => ELIGIBILITY_RULE_REGISTRY[id])
    .filter((rule): rule is EligibilityRule => rule !== undefined);
}
