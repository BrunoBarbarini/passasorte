# ADR-002: Monorepo with pnpm workspaces + Turborepo

## Status

PROPOSED

## Context

CLAUDE.md #14 specifies apps/ + packages/ with shared domain/application
code, and #50 asks for deliberate dependency management.

## Decision

Single repository, pnpm workspaces for package management, Turborepo for
task orchestration/caching across apps and packages.

## Consequences

Atomic cross-package changes (e.g. domain + API in one PR); requires
workspace-aware tooling (`pnpm -w`, `turbo run`); CI caches the pnpm store
and (later) Turbo's remote cache.
