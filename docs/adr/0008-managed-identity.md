# ADR-008: Managed identity provider + internal RBAC

## Status

PROPOSED

## Context

CLAUDE.md #17 requires managed identity plus internal roles (PARTICIPANT,
MERCHANT_OPERATOR, SUPPORT, OPERATOR, FINANCE, COMPLIANCE, ADMIN) with MFA
for privileged roles; #13 lists a managed OIDC/Firebase Authentication as
the assumption. CLAUDE.md #56 flags the exact provider as an open,
HIGH-priority technical question.

## Decision

Delegate authentication (credentials, MFA, recovery) to a managed identity
provider behind an internal `AuthPort`; PassaSorte owns authorization
(RBAC) on top of the provider's identity.

## Consequences

Avoids building/maintaining credential storage and MFA ourselves; the
concrete provider is still TBD (see docs/adr/0019-open-questions.md) and
must sit behind a port so swapping it later doesn't leak into domain code.
