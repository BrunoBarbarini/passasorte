# @passasorte/worker

Async worker process for PassaSorte (CLAUDE.md #10, #28): notifications,
webhooks, reconciliation, game progression, expiration/cleanup jobs.

**Status:** not scaffolded yet. The concrete jobs (`advance_game_step`,
`process_outbox_event`, `expire_position_holds`, ...) are introduced from
Phase 3 onward (CLAUDE.md #53), once there is domain/application code for
them to orchestrate. Scaffolding an empty worker process ahead of that
would be premature structure with nothing real to run.
