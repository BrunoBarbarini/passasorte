/**
 * @passasorte/analytics
 *
 * Thin wrapper around the product analytics provider (CLAUDE.md #20) with
 * a typed event catalog (`object_action` naming) so call sites cannot emit
 * an event name that doesn't exist and can never accidentally send
 * passwords, tokens, card data or unnecessary PII.
 *
 * Deliberately empty in Phase 0 (Foundation); the event catalog is
 * introduced alongside the funnels it measures (CLAUDE.md #21), starting
 * Phase 1.
 */
export {};
