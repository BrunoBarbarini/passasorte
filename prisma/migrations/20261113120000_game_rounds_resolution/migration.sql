-- Expand-only (CLAUDE.md 45): what is needed to rebuild the Engine V2 state by replay
-- (TASK-106). Both columns are written once, when the round is resolved.
alter table game_rounds
  add column if not exists resolution_steps jsonb,
  add column if not exists state_hash_after text;

comment on column game_rounds.resolution_steps is
  'ReplayStep[] produced by resolveRound for this round, in application order (FR-044).';
comment on column game_rounds.state_hash_after is
  'Engine V2 hash-chain head after this round was resolved.';

-- A SKIPPED outcome has no action and no execution type (the engine audit row carries null
-- for both). Keeping them NOT NULL would force inventing fake values (e.g. "STAY"), which
-- would corrupt the audit. Applied rows must still have both.
alter table round_actions
  alter column kind drop not null,
  alter column execution_type drop not null;

alter table round_actions
  add constraint round_actions_applied_has_action_check
  check (outcome = 'SKIPPED' or (kind is not null and execution_type is not null));
