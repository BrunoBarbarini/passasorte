-- Expand-only (CLAUDE.md 45): frozen Engine V2 configuration per room (BR-024/BR-089).
-- Nullable on purpose: rooms created before V2 have none, and the API rejects round
-- submissions for them with a clear message instead of assuming defaults.
alter table game_rooms
  add column if not exists engine_v2_config jsonb;

comment on column game_rooms.engine_v2_config is
  'GameConfigV2 frozen when the room starts: {winningZoneSize, maxMovementsPerRound}. maxMovementsPerRound is a number or an explicit null (BR-068/BR-089).';
