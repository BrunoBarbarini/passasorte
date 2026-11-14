-- Expand-only (CLAUDE.md 45): the participant's automatic action (DECISION-03/04).
-- NONE = absent participants skip the round without spending (DECISION-04).
alter table participations
  add column if not exists auto_action text not null default 'NONE'
  check (auto_action in ('NONE', 'LEFT', 'RIGHT', 'STAY'));
