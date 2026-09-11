# ADR-005: REST/JSON API under /api/v1

## Status

PROPOSED

## Context

CLAUDE.md #16 specifies REST JSON under `/api/v1`, a fixed error envelope,
cursor pagination and idempotency keys for critical commands.

## Decision

Use REST/JSON (not GraphQL/gRPC) for the public and backoffice API
surface, versioned via the URL prefix, documented via `@passasorte/api-contract`
and (later) OpenAPI.

## Consequences

Simple client integration (mobile/web) and caching; versioning is coarse
(whole-path `/v1`) rather than per-field, which is an accepted tradeoff for
MVP simplicity.
