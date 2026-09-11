# ADR-016: SSE/polling before WebSockets

## Status

PROPOSED

## Context

CLAUDE.md #10 says to start realtime with SSE or controlled polling and add
WebSockets only when justified; #57 flags realtime overengineering as a
risk.

## Decision

The live game view (CLAUDE.md #4.8) is powered by Server-Sent Events or
polling against authoritative server state at MVP scale (Stage 1-2,
CLAUDE.md #12). WebSockets/dedicated realtime infra are deferred to Stage
3+ if/when measured fanout needs justify them.

## Consequences

Simpler infra (no persistent connection fleet to manage) at the cost of
slightly higher latency/overhead per update than a WebSocket would give;
revisit only with evidence from Stage 2-3 load.
