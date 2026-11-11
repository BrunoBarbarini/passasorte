# Reconciliação do CLAUDE.md — PassaSorte

**Data:** 2026-11-11 · **Escopo:** reconciliar `CLAUDE.md` (antigo, 54,9 KB) com `PassaSorte_Core_Regras_Consolidadas.pdf` (CR-001..033) e `PassaSorte_Design_System.pdf` v1.0.
**Hierarquia aplicada:** Core (mecânica) > Design System (visual) > CLAUDE.md (engenharia) > ADRs aceitos > testes > contratos > código existente.
**Nenhum código foi alterado.** Esta etapa é documental.
**Atualização de 2026-11-11 (rodada 2):** o dono do produto fechou 5 dos 6 pontos que bloqueavam o motor (DECISION-01..06, §A.2). T-07 (plano final) e T-31 (confirmações) foram fechados como **ASSUMPTION** autorizada pelo dono e revisável. **Nenhum TBD bloqueia mais o Game Engine V1.**

**Correção central:** os jogadores **não** se movem. Após escolhidas, as posições são fixas; a **Sorte** é a única entidade móvel. `PLAYER_TRANSLATION_V1` e qualquer translação de posições de participantes estão obsoletos.

---

## A. Regras novas (trazidas do Core)

| Tema | Regra | Ref. |
|---|---|---|
| Barra | Barra horizontal de posições; N = Σ posições compradas pelos participantes confirmados (não é tamanho fixo) | CR-001..005 |
| Créditos | Créditos divididos entre posições e movimentos (10 créditos / máx. 80% são **exemplos**, viram configuração) | CR-006..009 |
| Sem reserva antecipada | Não há reserva de posição na entrada | CR-010 |
| Seleção após encerramento | Posições são escolhidas após o fechamento das entradas, na ordem de confirmação | CR-011 |
| Ausentes | Quem não escolhe recebe posições aleatórias (auditáveis) | CR-012/013 |
| Sorte inicial | Posição inicial aleatória e auditável | CR-014..016 |
| Rodadas e turnos | Seguem a ordem original de confirmação, com tempo limitado por turno | CR-017..021 |
| Movimentos | ESQUERDA / DIREITA / PARAR, com múltiplos créditos por turno | CR-022..024 |
| Estado compartilhado | O estado da Sorte passa ao próximo participante | CR-025 |
| Ação automática | Ação pré-configurada quando o participante está ausente no turno | CR-026 |
| Zona vencedora | K posições contíguas derivadas da posição final da Sorte; um participante pode ter várias posições vencedoras | CR-027..030 |
| Replay | Replay completo e auditável | CR-031..033 |

Do Design System: tokens (cores, tipografia, espaçamento, raio, sombras), componentes, iconografia, motion ("trajetória" e "pulso"), voz de marca e proibições (cassino/bet/loteria) — consolidados no §42–44 do novo CLAUDE.md.

Novas regras de negócio: BR-049..066 (o novo CLAUDE.md contém BR-001..066; BR-023 marcada como obsoleta; BR-061..066 vêm das decisões de 11/11).

### A.2 Decisões do dono de 11/11/2026 (FACT)

| ID | Decisão |
|---|---|
| DECISION-01 | Barra **circular** (`BAR_BOUNDARY_POLICY = CIRCULAR`): `N + RIGHT → 1`, `1 + LEFT → N`; 1 posição por crédito de movimento. Sem CLAMP, REJECT nem BOUNCE |
| DECISION-02 | **Unidade única de crédito**: 1 crédito = 1 posição OU 1 movimento, mesmo custo. Valor em dinheiro configurável por campanha (`creditUnitPrice`), separado de `creditQuantity` |
| DECISION-03 | Ausente com `autoAction` (LEFT/RIGHT/STAY): executa como jogada normal, consome 1 movimento, registrada como `AUTOMATIC` |
| DECISION-04 | Ausente sem `autoAction` (`NONE`): pula a vez, não consome nada, avisa o participante. Movimentos restantes **expiram** ao fim da participação (sem cashback, estorno, saldo, transferência ou carry-over) |
| DECISION-05 | Limite `maxCreditsPerParticipant` por campanha, validado no servidor de forma cumulativa; compra acima do limite é rejeitada por inteiro |
| DECISION-06 | MVP com `winningZoneSize = 1`: posição final da Sorte = posição vencedora = 1 ganhador. O engine suporta K > 1 no futuro, mas a regra de expansão **não** foi definida |

Os números dos exemplos (10/20 créditos, R$ 0,50, 200/300 posições) continuam sendo exemplos, nunca constantes.

## B. Conflitos (17)

| ID | Conflito | Fonte nova | Situação atual no código/CLAUDE.md antigo | Ação |
|---|---|---|---|---|
| C-01 | Jogadores movem-se vs. só a Sorte move | Core | `PLAYER_TRANSLATION_V1`, `positionIndex` no mobile | Aposentar (ADR-022, TASK-083) |
| C-02 | Reserva (hold) na entrada | CR-010 | `position_holds` + FR-024/025 | Remover; fase de seleção (ADR-023) |
| C-03 | Tamanho fixo/configurado do tabuleiro | CR-001..005 | Board fixo por sala | Barra dinâmica N = Σ posições |
| C-04 | Pacote de participação (posições+movimentos fixos) | CR-006..009 | `participation-package` | Divisão de créditos configurável |
| C-05 | Ordem de confirmação ausente | CR-011 | Não modelada | `confirmation_order` monotônico/único |
| C-06 | Ausentes sem política | CR-012/013 | Inexistente | Alocação aleatória derivada da semente |
| C-07 | Modelo de turno | CR-017..026 | Comandos livres + sequência do cliente | Tabela `turns`, prazo no servidor, ação automática |
| C-08 | "Final lock / final plan" | Core não menciona | `final-lock.ts`, FR-039/040 | Congelado até T-07; remoção posterior |
| C-09 | Zona vazia | CR-027..030 | Preocupação "zona vazia" | Resolvida estruturalmente (toda posição é comprada/auto-alocada) |
| C-10 | Semente em texto claro ao lado do commit | Integridade | `game_runs.seed` | Commit no OPEN + envelope KMS + reveal pós-COMPLETED |
| C-11 | Gasto de movimento não atômico | Concorrência | Leitura/escrita separadas | `UPDATE … SET used = used + :n WHERE used + :n <= bought` |
| C-12 | Chave de idempotência global | Segurança | Única por chave | `UNIQUE(user_id, route, key)` + hash do request + snapshot da resposta |
| C-13 | Histórico mutável no banco | Auditoria | Sem append-only | Triggers + revogação de UPDATE/DELETE + hash-chain |
| C-14 | Hospedagem do banco | Prompt (Cloud SQL) vs. decisão (Supabase Postgres) | Supabase via PgBouncer | Mantida como ASSUMPTION; sinalizada em T-25 |
| C-15 | SLOs documentados desatualizados | Operação | `docs/slo/slos.md` | Atualizar (TASK-090) |
| C-16 | Idioma/localização | BR-048 | pt-BR/BRL | Preservado |
| C-17 | Barra circular, crédito único, limite por campanha e turno pulado (decisões de 11/11) | Decisões 01–05 | Código de board/movement/temperature pode assumir barra limitada e distância linear; sem `maxCreditsPerParticipant`; `autoAction` sem `NONE` | Auditar e migrar (TASK-093..097) |

## C. Regras removidas / alteradas

- **Removidas/obsoletas:** BR-023 (`PLAYER_TRANSLATION_V1`), FR-024/025 (hold atômico/expiração na entrada), ADR-018 (efeito do movimento → superado pelo ADR-022), FR-039/040 (lock final — congelado, T-07), FR-029 (pacote fixo).
- **Alteradas:** FR-020 (tabuleiro dinâmico), FR-035/036/037/038 (movimento da Sorte, idempotência escopada), FR-041 (turnos), BR-014 (distância ao centro/zona usa a posição final da Sorte), estados de sala/participação/turno (§9 do novo CLAUDE.md), BR-022 (efeito do movimento: Sorte move; unidade/borda → T-01/T-02).
- **Decididas em 11/11:** BR-022 (barra circular, 1 posição por crédito), BR-013/033 (MVP `winningZoneSize = 1`), BR-043 (limite de créditos por campanha), BR-052 (ação automática), CR-008 (o "80%" passa a ser só exemplo), CR-021/023/027/029/032.
- **Preservadas:** servidor autoritativo, relógio do servidor, dinheiro em unidades menores inteiras, feature flags OFF por padrão, LEGAL GATE para participação paga, Supabase Auth + RBAC interno, pt-BR na UI.

## D. TBDs classificados (31)

| Situação | Itens | Qtd. |
|---|---|---|
| **Resolvidos por decisão do dono (11/11)** | T-01, T-02, T-04, T-06 | 4 |
| **Resolvidos como ASSUMPTION autorizada (11/11)** | T-07, T-31 | 2 |
| **CRITICAL (aberto)** | T-21 (LEGAL GATE) | 1 |
| **HIGH (abertos)** | T-03, T-08, T-09, T-10, T-12, T-14, T-17, T-18, T-19, T-20, T-22, T-25, T-26, T-30 | 14 |
| **MEDIUM (abertos)** | T-05, T-11 (rebaixados: só importam para K > 1), T-13, T-15, T-16, T-23, T-24, T-27, T-29 | 9 |
| **LOW (aberto)** | T-28 | 1 |

Total registrado: 31 (6 resolvidos, 25 abertos). **Nenhum TBD bloqueia o Game Engine V1.**

**Regras assumidas em 11/11 (ASSUMPTION, revisáveis):**

- **T-07:** não existe plano final / final lock; o jogo termina no último turno da última rodada.
- **T-31a:** STAY manual consome 1 movimento.
- **T-31b:** `maxMovementsPerTurn` por campanha, sem valor padrão; exige número explícito ou "sem limite" explícito.
- **T-31c:** não há comando "passar"; não agir até o prazo torna o participante ausente.
- **T-31d:** ausente = nenhuma jogada aceita até o prazo do servidor (o instante exato do prazo segue no T-03).
- **T-31e:** ação automática com saldo zero = turno pulado com motivo `NO_MOVEMENTS_LEFT`.
- **T-31f:** a ação automática consome sempre exatamente 1 movimento.

**Risco que permanece (R-21):** pular a vez não custa nada; `maxMovementsPerTurn` e a simulação antes do piloto controlam o acúmulo para o último turno. A ordem fixa dos turnos mantém a vantagem de quem joga por último, aceita como risco conhecido.

## E. Arquitetura proposta

Mantida: monólito modular (NestJS + Fastify), Prisma, PostgreSQL como fonte da verdade, Redis apenas cache/rate-limit, outbox transacional, workers, Supabase Auth + RBAC interno, GCP como alvo (ASSUMPTION).

Mudanças:
- **GameEngine V2** puro e versionado (`initialize / applyMovement / calculateWinners / replay`), sem `Date.now()`/`Math.random()`/I-O; hashes de estado canônicos (`previousStateHash` → `currentStateHash`).
- **Fases:** OPEN → ENTRY_LOCKED → POSITION_SELECTION → READY → RUNNING → RESOLVING → COMPLETED.
- **Tabelas-alvo:** `bar_positions`, `turns`, `movement_commands`, `game_transitions` (hash-chain), `randomness_commitments/reveals`, `game_results`, `idempotency_records`.
- **Aleatoriedade:** commit SHA-256(seed‖roomId‖engineVersion) **antes** de N ser conhecido; semente em envelope KMS; reveal após COMPLETED; fluxos derivados rotulados (Sorte inicial, posições de ausentes).
- **Concorrência:** lock por sala nos turnos; guarda `used + n <= bought`; DB como guarda final.
- **Migração:** expandir → migrar → contrair (§41).

## F. Revisão de segurança

- **Controle de acesso:** RBAC deny-by-default; ADMIN **não** reescreve histórico (append-only no banco); verificação de propriedade (IDOR) em todo comando.
- **OWASP/STRIDE:** tabela de ameaças no §19; rate limit por rota; replay de comandos mitigado por idempotência escopada + sequência do servidor.
- **Segredos/Cripto:** KMS/Secret Manager; nenhum segredo no repositório; `.env*` não lidos nesta análise; **credenciais já coladas em chat/logs devem ser rotacionadas** (R-19).
- **MFA:** exigido para papéis privilegiados em produção; MFA no mobile pendente (T-27).
- **Supply chain:** lockfile, scans de dependências/segredos/SAST no CI (lacunas: staging, E2E e integração com Postgres real).
- **Lacunas atuais:** semente em claro (C-10), sem append-only (C-13), idempotência global (C-12), sem mecanismo auditado de concessão de papéis.

## G. Revisão de fraude

Vetores: múltiplas contas, bots/sniping na seleção e nos turnos, replay de movimento, cliente falso, fraude de pagamento, insider, fraude de merchant, reutilização de benefício, colusão para ganhar território. Resposta graduada (sinalizar → fricção/CAPTCHA → revisão → bloqueio) com `risk_events`, limites por usuário/sala (T-30), janelas de escolha, auditoria de decisões e base legal LGPD para sinais de dispositivo (T-22). Estratégia de pular/acumular movimentos (R-21): vigiar padrões de turnos pulados e ausências coordenadas entre contas. Fraude de resultado: engine versionado, semente comprometida, KMS, hash-chain, verificador de replay noturno com alerta.

## H. Revisão do Design System

- Tokens do PDF (Noite `#10162F`, Território `#2B2D70`, Movimento `#6D5DFB`, Calor `#FF6B57`, Pulso `#FFB84D`, Descoberta `#2CC9B7`; espaçamento base 4; raios 10/16/24/pill; Inter) aplicados no §42.
- **Lacunas:** o mobile usa a fonte da plataforma, não Inter; "Morno" não tem hex no DS (interpolado — escolha visual); tokens duplicados em mobile/web (extrair `packages/design-tokens` com o 3º consumidor).
- **Guardrails de UX:** sem placar monetário, multiplicadores, odds, fichas, roleta; temperatura nunca só por cor; animações nunca contradizem o estado do servidor; ações irreversíveis explícitas.
- **Acessibilidade (WCAG 2.2 AA):** janelas curtas de turno (5–10 s) levantam 2.2.1; mitigação pela ação automática pré-configurada e janela mínima configurável (T-03).

## I. Próximos passos

1. **Engine V2 puro** (em andamento): deslocamento circular, estado, cadeia de hash, `applyMovement`, `skipTurn`, `calculateWinners`, `replay` e os cenários G-01..G-12 do CLAUDE.md §36.1 (TASK-071, 093..097).
2. Auditar e migrar o código existente (barra limitada, distância linear, pacote de participação, `autoAction` sem `NONE`) e retirar o que ficou obsoleto, incluindo o plano final (TASK-083).
3. Migração de esquema (expandir) e suíte de concorrência com Postgres real (TASK-084, 085).
4. Simular o risco R-21 (pular rodadas e gastar tudo no último turno) antes do piloto.
5. Atualizar `docs/slo/slos.md` (C-15) e o `README` desatualizado.
6. Decisão jurídica (T-21) antes de qualquer ativação de participação paga.

**Não iniciar** novas funcionalidades de produto sobre o modelo obsoleto enquanto o Engine V2 e a migração estiverem abertos.
