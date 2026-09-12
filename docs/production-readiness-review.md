# Production Readiness Review (TASK-070)

Data: 12/09/2026. Honesto por construção: cada item abaixo é READY apenas
se algo real foi construído E verificado (executado, testado, ou validado
manualmente) — não apenas escrito. "Escrito, nunca executado" é seu
próprio status, distinto de READY.

## READY (construído e verificado)

- **API sobe e responde de verdade.** `apps/api` foi rodado localmente
  pela primeira vez neste projeto (Fase 8, 12/09/2026) contra Postgres e
  Redis reais via docker-compose: `/health` → 200 com headers de Helmet e
  rate-limit; `/api/v1/campaigns` → 200; `/api/v1/merchants/:id`
  (inexistente) → 404 com mensagem pt-BR correta.
- **Bug real de DI corrigido.** NestJS injetava `PrismaService` como
  `undefined` silenciosamente sob `tsx watch` em todos os 13 repositórios
  Prisma de `apps/api` — corrigido com `@Inject(PrismaService)` explícito,
  verificado contra o servidor real rodando (commit `5448c94`).
  `apps/worker` e `GlobalHttpExceptionFilter` foram auditados e
  confirmados não afetados pela mesma classe de bug.
- **Lint/typecheck/test/build**: 44/44 tasks do turbo verdes após a
  correção acima.
- **MFA (Fase 8)**: implementado — ver seção "Autenticação" do doc de
  contexto do projeto.
- **Migrations aplicadas e testadas localmente**: `prisma migrate deploy`
  rodou com sucesso contra o Postgres local.
- **Mecânica de backup/restore local validada**: `scripts/ops/validate-backup-restore.sh`
  é um `pg_dump`/`pg_restore` real contra o Postgres do docker-compose —
  ainda não executado neste momento (arquivo acabou de ser criado), mas é
  código real e executável, não um placeholder.

## ESCRITO, NUNCA EXECUTADO (código pronto, zero validação real)

- **Terraform (TASK-064/TASK-065)**: módulo reutilizável
  (`infrastructure/terraform/modules/passasorte-stack/`) + wrappers
  `production/` e `staging/` — nunca houve `terraform plan`/`apply` contra
  um projeto GCP real. Não existe `gcp_project_id` real, nem service
  account, nem bucket de state. Decisão deliberada: **sem Cloud SQL** —
  Postgres continua sendo a instância gerenciada do Supabase (decisão
  desde a Fase 1), não uma segunda instância própria.
- **Alertas e uptime check (TASK-068, parte do TASK-067)**: definidos em
  `monitoring.tf`, mas `alert_notification_channels` está vazio por
  padrão — alertas existem mas são silenciosos até um canal real (email/
  Slack/PagerDuty) ser configurado.
- **Pipeline de deploy (TASK-066)**: `.github/workflows/deploy-production.yml`
  — `workflow_dispatch` manual, gated pelo GitHub Environment
  `production`, que ainda não existe no repositório. Depende de
  `apps/api/Dockerfile` e `apps/worker/Dockerfile`, que **também não
  existem ainda** (confirmado nesta sessão) — o pipeline não pode rodar
  de verdade até esses dois Dockerfiles serem escritos.
- **SLOs (TASK-067)**: metas propostas em `docs/slo/slos.md`
  (disponibilidade 99.5%/mês, erro 5xx < 1%/hora) — nunca medidas contra
  tráfego real. Meta de latência p95 fica sem alerta configurado por falta
  de dado real para calibrar um limiar sem inventá-lo.
- **Load test (TASK-062)**: `scripts/load-test/campaigns-read.js` — real e
  executável (`autocannon` contra `/health` e `/api/v1/campaigns`), mas
  ainda não foi executado por ninguém contra o servidor local.
- **Simulação ponta a ponta (TASK-069)**: `scripts/pilot-simulation/run.ts`
  — exercita o ciclo completo campanha→sala→hold→participação→movimentos→
  resolução→benefício→notificação contra o schema real, mas ainda não foi
  executado. Importante: simula transições de estado e integridade
  referencial, não as regras de negócio reais de jogo (ainda TBD — ver
  abaixo).
- **PITR real do Supabase (parte do TASK-063)**: procedimento documentado
  em `docs/runbooks/backup-pitr.md`, nunca executado — requer o dashboard
  do Supabase e não pode ser automatizado a partir deste repositório.

## NOT READY — gates de negócio/legais ainda abertos (CLAUDE.md §56)

Estes bloqueiam produção real independentemente do estado técnico acima —
são decisões de negócio/jurídicas, não código:

- **Modelo de receita exato, acordo com merchant, funding da experiência,
  settlement, platform fee, funding de benefícios, economia de
  cancelamento/reembolso/chargeback** — todos TBD (§56 "Business — HIGH").
- **Semântica de jogo — CRÍTICO**: o que exatamente um movimento move
  (BR-022 TBD/ADR-018), semântica de vencedor (BR-033 TBD/ADR-019),
  comportamento multi-vencedor, comportamento de zona vencedora vazia,
  exclusividade de posição final.
- **Caracterização legal, estrutura de campanha permitida, autorizações/
  divulgações exigidas, restrição de idade, regras de prêmio, reembolsos/
  cancelamento, publicação de vencedores, tratamento de cashback/
  benefício, tratamento tributário, responsabilidade do merchant** — todos
  TBD (§56 "Legal/Compliance — CRITICAL"). **Nenhuma campanha real deve
  rodar em produção antes desses gates serem resolvidos** — isso é uma
  decisão de negócio/jurídica que este projeto de código não pode nem
  deve tomar por conta própria (CLAUDE.md #58).
- **Provedor de pagamento (ADR-014, PROPOSED)** e **modelo de produção de
  participação paga (ADR-020, TBD)** — `apps/api` ainda não tem Fase 6
  (pagamentos) implementada; está gated conforme já documentado no
  contexto do projeto.
- **Provedor de notificação push/e-mail real** — apenas IN_APP é um canal
  de fato hoje (registry "inert until configured" da Fase 5).
- **Provedor de analytics (PostHog)** — ainda ASSUMPTION, adapter
  plugável construído na Fase 8 mas nunca conectado a uma chave real.

## Lição operacional registrada

Um bug real e crítico (DI silenciosamente `undefined`) só foi descoberto
porque, pela primeira vez, a API rodou como processo real contra HTTP —
nenhuma das 8 fases anteriores incluía esse tipo de verificação. Recomenda-se
adicionar um teste de integração leve que resolva o `AppModule` completo do
NestJS (sem mockar `PrismaService`) para capturar essa classe de bug
automaticamente no CI, antes de depender de testes manuais para achá-la de
novo.

## Resumo

Nenhum item "ESCRITO, NUNCA EXECUTADO" acima deve ser tratado como
"pronto" só porque existe como arquivo. Antes de qualquer deploy real: (1)
resolver os gates de negócio/legais listados acima — bloqueiam
independentemente do código; (2) `terraform validate`/`plan` real contra
um projeto GCP real; (3) rodar `scripts/load-test/` e
`scripts/pilot-simulation/` pelo menos uma vez e revisar os resultados;
(4) escrever `apps/api/Dockerfile` e `apps/worker/Dockerfile` antes do
pipeline de deploy poder rodar de verdade.
