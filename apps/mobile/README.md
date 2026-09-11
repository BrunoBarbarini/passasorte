# PassaSorte Mobile

Participant-facing mobile app (CLAUDE.md #2.7, #9, #13): React Native +
Expo (ASSUMPTION, see docs/adr/0006-expo-react-native.md).

**Status:** Phase 4 ("Participant Mobile Journey") scaffold — TASK-036
through TASK-044: application shell, home (public campaign catalog),
campaign detail + rooms, Supabase email/password auth, position
selection + hold, participation creation + confirmation, live game
(movement submission), final lock and result screens.

## Running locally

```bash
cp .env.example .env.local   # fill in EXPO_PUBLIC_API_BASE_URL for your machine/simulator
pnpm --filter @passasorte/mobile start
```

Requires apps/api running locally (see repo root README/.env.example) and
reachable from your device/simulator at `EXPO_PUBLIC_API_BASE_URL`.

## Known Phase 5 gaps (intentional — see CLAUDE.md #58, never invented)

- **Live Game**: shows the participation's current stored state and lets
  the participant spend a movement while `ACTIVE`, but there is no
  continuously advancing Sorte zone yet — that requires Phase 5's
  scheduler (TASK-034) actually running rounds.
- **Final Lock**: informational only (shows `finalPhaseStartSequence`
  and movement usage). Automatic enforcement of the final lock is
  Phase 5 scope (TASK-030).
- **Result**: only ever displays the participation's actual stored
  status. The Game Result Engine / Winner Model (TASK-031/032) that
  would resolve `WON`/`NOT_WON` doesn't exist yet, so most participations
  will show "resultado ainda não disponível" until Phase 5 ships.
