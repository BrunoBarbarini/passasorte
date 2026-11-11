# Auditoria do código legado × Engine V2 (decisões de 2026-11-11)

Status: **somente leitura** — nenhum código legado, migração ou banco foi alterado.
Base: Engine V2 puro em `packages/domain/src/game/v2/` (39 testes), ADR-022, regras CR/DECISION-01..06 e ASSUMPTIONs T-07/T-31.

## 1. Resumo executivo

O legado (Fases 2–5) foi construído sobre o modelo antigo: **jogador se move, barra limitada (clamp), distância linear, zona da Sorte com largura, pacote de participação (posições+movimentos), hold de posição com TTL, final lock/plano final, vencedor 0..N**. O Engine V2 inverte isso: **só a Sorte se move, barra circular, 1 posição por crédito, créditos únicos (posição OU movimento), turnos com ação automática, vencedor único, sem final lock**.

Consequência: o legado **não pode ser adaptado em pequenos passos**; o núcleo de jogo é substituído. Cerca de 85 arquivos rastreados tocam o modelo antigo. O que se mantém é a infraestrutura (outbox, auditoria, auth, campanhas, notificações, benefícios, observabilidade).

## 2. Divergências estruturais (legado × novo)

| # | Tema | Legado | Novo (V2) | Impacto |
|---|------|--------|-----------|---------|
| D1 | Quem se move | Posição do jogador (`PLAYER_TRANSLATION_V1`, `positionIndex`) | Só a Sorte; posições fixas | REMOVER comando por posição |
| D2 | Bordas | `clamp` em `[0,size-1]` | Circular, 1..N (`N+RIGHT→1`) | Reescrever |
| D3 | Indexação | 0-based | 1-based (1..N) | **Risco de off-by-one em toda a fronteira API/DB/UI** |
| D4 | Distância | Linear até uma *zona* com largura | Circular `min(|a−b|, N−|a−b|)` até a posição da Sorte | Reescrever temperatura |
| D5 | Sorte | Zona `[start,end]` com random walk clamp | Posição única, deslocada pelos comandos | Reescrever `sorte.ts`, `sorte-progression.ts` |
| D6 | Vencedor | Lista 0..N, “dentro da zona” | 1 posição final → 1 dono → 1 vencedor (K=1) | Reescrever `winner-selection.ts`; `winners` 1:1 |
| D7 | Créditos | `ParticipationPackage {positionCount, movementAllowance}` | Crédito único; compra = quantidade; split posição/movimento; `maxCreditsPerParticipant` | Remover pacote; novo modelo de crédito |
| D8 | Alocação | Hold por posição com TTL; ocupação parcial | Cada posição da barra tem exatamente 1 dono ao iniciar | Repensar entrada (capacidade = tamanho da barra) |
| D9 | Final lock | Estado `FINAL_LOCK`, plano final imutável, grace period | Inexistente (BR-067) | REMOVER estado, tabela/coluna, tela, endpoint |
| D10 | Ausência | “Keep last submitted” (simulação) | Auto-ação (`LEFT/RIGHT/STAY`) ou turno pulado; movimentos não usados expiram | Novo fluxo de turno |
| D11 | Ordem | `sequence` enviada pelo **cliente** | Turnos do servidor (`turnId`), um consumo por turno | Viola “servidor é autoridade”; REMOVER |
| D12 | Auditoria do jogo | `steps` JSON + seed em texto | Cadeia de hashes por transição + commit/reveal | Novas tabelas append-only |
| D13 | Aleatoriedade | `seed` guardada em claro junto ao commitment | Commit/reveal com KMS (ADR-025 proposta) | Seed não pode ficar legível antes do reveal |

## 3. Classificação por arquivo

Legenda: **REMOVER** (sai ao final do contract), **REESCREVER** (mesmo papel, novo conteúdo), **ADAPTAR** (mudança pontual), **MANTER**.

### Domínio (`packages/domain/src`)
- `game/movement.ts` — REMOVER (`PLAYER_TRANSLATION_V1`, `positionIndex`); parte de allowance → absorvida por `v2/credits.ts`.
- `game/final-lock.ts` — REMOVER.
- `game/sorte.ts`, `sorte-progression.ts`, `winner-selection.ts`, `temperature.ts` — REESCREVER (V2: posição única, circular, K=1). `temperature.ts`: manter bandas configuráveis e a normalização, trocar a distância por `circularDistance`.
- `game/game-config.ts` — REESCREVER (`GameConfigV2`: `barSize`, `winningZoneSize`, `maxMovementsPerTurn`, `autoAction`, `creditUnitPrice`, `maxCreditsPerParticipant`; remover `finalLock`, `initialSorteZone`, `movementAllowancePerParticipation`).
- `game/game-engine.ts` — REMOVER quando as salas migrarem (V1 de simulação). Mantém-se durante a transição.
- `game/board.ts` — ADAPTAR (1..N, sem `quadrants` obrigatório; ver T-aberto sobre regiões).
- `game/room-operations-config.ts` — ADAPTAR (remove `finalLockGracePeriodMs`; adiciona prazo de turno).
- `game/randomness-commitment.ts` — ADAPTAR (hoje alimenta o random walk; V2 só precisa dele para a posição inicial — T-13).
- `participation/participation-package.ts` — REMOVER.
- `participation/movement-command-submission.ts` — REESCREVER (comando `{turnId, direction, credits}` com validações do V2).
- `participation/participation.entity.ts` e máquina — ADAPTAR (remover `LOCKED`; novo conceito de saldo de movimentos/expiração).
- `room/room-state-machine.ts` — ADAPTAR (remover `FINAL_LOCK`; `RUNNING → RESOLVING`).
- `room/position-hold.entity.ts` — REESCREVER ou REMOVER (depende de T abertos sobre a mecânica de entrada; ver §6).
- `room/room.entity.ts` — ADAPTAR.

### Aplicação (`packages/application/src`)
- `use-cases/game/advance-room-operations.use-case.ts` (216 linhas) — **REESCREVER**: hoje detecta final lock por maior `sequence` e resolve com política simulada. V2: avança turno por prazo, chama `planAbsentTurn`/`skipTurn`/`complete`, persiste transições + hash.
- `use-cases/participation/submit-final-movement-command.use-case.ts` — REMOVER.
- `use-cases/room/{hold-positions,create-room,start-room}.use-case.ts`, `game/expire-position-holds.use-case.ts` — REESCREVER/REMOVER conforme §6.
- `use-cases/participation/{create,confirm}-participation.use-case.ts` — ADAPTAR (créditos, limite por participante, compra rejeitada por inteiro acima do limite).
- Ports `game-run-repository`, `participation-repository`, `position-hold-repository`, `room-repository` — REESCREVER/ADAPTAR (turnos, transições, comandos).
- Testes (`hold-positions`, `participation-use-cases`, `create-room`, `open-room`, `phase8-analytics-outbox` com 32 ocorrências) — REESCREVER junto.

### API / Worker
- `apps/api/.../repositories/{game-run,participation,position-hold,room}.repository.ts` e espelhos em `apps/worker` — REESCREVER. **Duplicação api/worker** das mesmas classes Prisma é um risco de divergência (recomendo extrair para pacote compartilhado antes de mexer).
- `modules/participations.controller.ts` — `POST participations/:id/movements` (usa `positionIndex` + `sequence` do cliente) → REESCREVER; `POST participations/:id/final-movement` → REMOVER.
- `modules/rooms.controller.ts` — `POST rooms/:roomId/holds` → decidir (§6); `lock-entries`/`start` ADAPTAR.
- `modules/operations.controller.ts`, `catalog.controller.ts` — ADAPTAR (dashboards e DTOs).
- `apps/worker/src/scheduler.ts`, `main.ts` — ADAPTAR (remove listagem `FINAL_LOCK`; adiciona jobs de turno: `advance_game_step`, `detect_stuck_rooms`).

### Contratos (`packages/api-contract`)
- `participations.ts` — `SubmitMovementSchema`, `SubmitFinalMovementSchema` → REESCREVER/REMOVER. Contrato muda: **versionar** (`/api/v1` com app mobile publicado exige janela de compatibilidade, NFR-019).
- `rooms.ts` — ADAPTAR.

### Banco (`prisma/schema.prisma`)
- `GameRoomStatus.FINAL_LOCK`, `GameRoom.finalLockedAt`, `operationsConfig.finalLockGracePeriodMs` — contract.
- `PositionHold`/`PositionHoldStatus` — destino depende de §6.
- `Participation.positions Int[]`, `movementAllowanceTotal/Used`, `finalMovementPlan` — substituir por modelo de créditos e `bar_positions`.
- `MovementCommandLog (positionIndex, direction, sequence)` — substituir por `movement_commands` com `turnId`, `executionType`, `credits`.
- `GameRun {seed texto, steps JSON}` — substituir por commitments/reveals + `game_transitions` encadeadas.
- `Winner` — 1:1 com resultado (unique).
- `IdempotencyKey (key único global)` — ADAPTAR para escopo (usuário/rota/chave).
- Migrações `20260911223000_phase4…` e `20260912021100_phase5…` **não podem ser editadas** (já aplicadas); toda mudança vai em migração nova (expand→migrate→contract).

### Mobile / Web
- Mobile: `FinalLockScreen.tsx` REMOVER; `LiveGameScreen.tsx` REESCREVER (hoje envia `positionIndex: 0` e `sequence` calculada no cliente — viola a autoridade do servidor); `PositionSelectionScreen.tsx` REESCREVER; `types/api.ts`, `navigation/*`, `CampaignDetailScreen.tsx` ADAPTAR. UI deve seguir o Design System (temperatura nunca só por cor).
- Web backoffice: `campaigns/[id]`, `rooms/[id]`, `dashboard` e `types/api.ts` ADAPTAR (config nova de sala, remover final lock).

### Scripts
- `scripts/pilot-simulation/run.ts` (19 ocorrências) — grava direto no schema legado; **quebra** na migração. Reescrever depois do contract, ou congelar. Não rodar o piloto antes da simulação de R-21.

## 4. Riscos específicos da migração

1. **Off-by-one 0-based → 1-based** (D3): afeta DB, contrato, mobile e testes. Mitigar com tipo de domínio `BarPosition` (1..N) e conversão só na borda, com teste de fronteira (G-01..G-04).
2. **Salas ativas**: BR-024 exige engine/config imutáveis por sala ativa. Salas já `RUNNING` no legado terminam no engine antigo; novas salas usam V2 (`engineVersion` por sala). Só remover o V1 quando não houver sala ativa — verificar em produção antes do contract.
3. **Clientes mobile antigos** enviando `positionIndex/sequence`: manter endpoint legado respondendo 410/`ENGINE_UNSUPPORTED` por uma janela, nunca aceitar silenciosamente.
4. **Duplicação api/worker** dos repositórios Prisma.
5. **Seed em claro** (D13): enquanto não houver KMS (ADR-025), seed legível por quem tem acesso ao banco — risco de manipulação por admin (BR-031).
6. **R-21** (hoarding/last-mover): resolver por simulação antes do piloto.
7. **Dados históricos**: `winners`, `game_runs` de salas encerradas são histórico imutável (BR-046) — não migrar nem apagar; marcar como `engineVersion` legado.
8. **LGPD/auditoria**: novas tabelas de transição precisam de append-only por trigger e grants sem UPDATE/DELETE.

## 5. Ordem de migração proposta (expand → migrate → contract)

**Etapa 0 — preparação (sem risco)**
- Extrair repositórios Prisma duplicados api/worker para um pacote único.
- Fixar `engineVersion` por sala (já existe em `gameConfig`) e adicionar teste que impede mudar config de sala ativa.

**Etapa 1 — expand (migração aditiva)**
- Novas tabelas: `bar_positions`, `turns`, `movement_commands`, `game_transitions` (hash encadeado), `randomness_commitments`/`reveals`, `credit_purchases`, `idempotency_records` com escopo.
- Colunas novas em `game_rooms` (`engine_version`, `bar_size`, config V2) — todas nulas/default para não afetar salas legadas.
- Triggers append-only e grants (sem UPDATE/DELETE) nas tabelas de transição/comando.

**Etapa 2 — adaptadores (dual-path)**
- Adapter Prisma ↔ `gameV2` (puro) em `application`, escolhido por `room.engineVersion`.
- Use cases novos: comprar créditos, submeter movimento (com idempotência), avançar turno (worker), completar e resolver.
- Suíte de concorrência em Postgres real (TASK-085): uma posição/um dono; um consumo por turno; compra acima do limite rejeitada inteira.

**Etapa 3 — migrate**
- Novas salas nascem V2. Mobile/web novos consomem contrato novo (versionado). Endpoints legados retornam erro explícito.
- Simulação de R-21 e do fluxo completo antes de ligar ao piloto.

**Etapa 4 — contract (só com zero salas legadas ativas)**
- Remover `FINAL_LOCK`, `PositionHold` (se confirmado), `finalMovementPlan`, `positionIndex`, `MovementCommandLog`, `PLAYER_TRANSLATION_V1`, `final-lock.ts`, pacote de participação, `game-engine.ts` V1, telas antigas.
- Migração destrutiva em release separado, com backup/PITR validado (NFR-014/015).

## 6. Pontos que precisam de decisão (não inventei regra)

Estes aparecem na auditoria porque o V2 exige **posições totalmente ocupadas ao iniciar**, mas as regras de *como as posições são adquiridas* continuam abertas nos TBDs:
- **Entrada e escolha de posições**: o participante escolhe a posição específica? Há hold com TTL? O jogo só inicia com a barra cheia, ou posições vagas são preenchidas/pertencem à casa? Hoje o código assume hold por posição e ocupação parcial. Mantive `PositionHold` como “destino pendente”.
- **Posição inicial da Sorte** (T-13): distribuição ainda aberta; o engine recebe a posição do chamador.
- **Prazo de turno e ordem de turnos** (T-03): exato comportamento no prazo.
- **Quadrantes/regiões** em `board.ts`: continuam no conceito novo?

Sugestão: responder esses quatro antes da Etapa 1, pois definem o schema de `bar_positions` e `credit_purchases`.

## 7. Esforço relativo (ordem de grandeza)

Domínio ~ pequeno (V2 já pronto); aplicação + ports ~ médio; Prisma/migrações ~ médio; API/contrato ~ médio; mobile/web ~ grande (UX nova pelo Design System); testes/concorrência ~ médio. Etapa 0–2 cabe em um ciclo curto sem tocar produção.
