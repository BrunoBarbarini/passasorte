# ADR-006: Expo + React Native for the mobile app

## Status

PROPOSED

## Context

CLAUDE.md #2.7 requires mobile-first participant UX; #13 lists Expo React
Native as the assumed stack.

## Decision

Build the participant mobile app with React Native + Expo, sharing
TypeScript types with the backend via `@passasorte/api-contract`.

## Consequences

Fast iteration and OTA updates via Expo; not yet scaffolded (see
apps/mobile/README.md) since it depends on Phase 1 APIs.
