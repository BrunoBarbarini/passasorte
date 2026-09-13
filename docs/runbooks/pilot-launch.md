# Runbook: Pilot Launch (Fase 9)

## Escopo

O CLAUDE.md descreve a Fase 9 apenas em prosa — "merchants controlados,
salas limitadas, monitoramento forte e revisão diária de produto" — sem
nenhuma tarefa numerada de backlog (diferente de todas as fases
anteriores). Este runbook cobre a parte **operacional** dessa fase; a
parte **técnica** (o gate de allow-list de merchant + limite de salas
ativas) está implementada em `packages/domain/src/pilot/pilot-policy.ts`
e é configurada pelas três variáveis de ambiente descritas abaixo.

Este documento não inventa nomes de merchants, quantidade de merchants
piloto, nem um valor numérico para o limite de salas ativas — essas são
decisões de negócio/operação que cabem a quem está rodando o piloto no
momento, não a este repositório (CLAUDE.md #58: nunca inventar regra de
negócio ou valor não informado).

## 1. Mecanismo técnico do gate

Três variáveis de ambiente (ver `.env.example` e
`packages/config/src/env.schema.ts`):

- `PILOT_MODE_ENABLED` (`true`/`false`, padrão `false`) — liga/desliga o
  gate inteiro. Com `false` (ou não definida), o piloto é um **no-op
  completo**: nenhum merchant é bloqueado e não há limite de salas ativas,
  independentemente do valor das outras duas variáveis.
- `PILOT_ALLOWED_MERCHANT_IDS` — lista de UUIDs de merchant separados por
  vírgula, permitidos a operar enquanto o piloto está habilitado. **Vazia
  ou não definida com `PILOT_MODE_ENABLED=true` significa que nenhum
  merchant está liberado ainda** — essa é a falha segura; o piloto nunca
  assume "permitir todos" por omissão.
- `PILOT_MAX_ACTIVE_ROOMS` — número máximo de salas simultaneamente ativas
  (`OPEN`, `ENTRY_LOCKED`, `RUNNING`, `FINAL_LOCK`, `RESOLVING`) na
  plataforma inteira enquanto o piloto está habilitado. Não definida
  significa sem limite.

O gate é aplicado em dois pontos:

1. **Criação de sala** (`CreateRoomUseCase`) — antes de criar a sala,
   resolve o merchant da campanha (`campaignId` → `Campaign.merchantId`) e
   verifica (a) se esse merchant está na allow-list e (b) se o número
   atual de salas ativas já atingiu o limite. Qualquer violação lança
   `ConflictError` (HTTP 409).
2. **Publicação de campanha** (`TransitionCampaignUseCase`, transição para
   `PUBLISHED`) — bloqueia a publicação se o merchant da campanha não
   estiver na allow-list. Isso evita que uma campanha de um merchant fora
   do piloto sequer chegue a ficar visível publicamente, mesmo antes de
   qualquer sala ser criada.

Testes automatizados cobrem ambos os pontos e os casos de borda (gate
desabilitado, allow-list vazia, limite atingido exatamente, sem limite) —
ver `packages/domain/src/pilot/__tests__/pilot-policy.test.ts`,
`packages/application/src/__tests__/create-room-use-case.test.ts` e
`packages/application/src/__tests__/campaign-use-cases.test.ts`.

## 2. Como configurar um piloto real

1. Definir com o time de produto/negócio quais merchants participarão do
   piloto e obter os UUIDs reais deles (`Merchant.id` no banco) — este
   runbook não lista nem sugere merchants específicos.
2. Decidir, com o time de operações, o limite de salas ativas simultâneas
   que a operação consegue monitorar de perto no início do piloto — não
   há um número padrão aqui; deve refletir a capacidade real de
   acompanhamento manual disponível.
3. Configurar as três variáveis no ambiente de deploy (staging ou
   produção, conforme o plano de rollout):
   ```
   PILOT_MODE_ENABLED=true
   PILOT_ALLOWED_MERCHANT_IDS=<uuid-1>,<uuid-2>,...
   PILOT_MAX_ACTIVE_ROOMS=<número decidido no passo 2>
   ```
4. Fazer o deploy e confirmar (por log ou por uma tentativa controlada de
   criar uma sala para um merchant fora da lista) que o gate está
   realmente ativo antes de anunciar o piloto como "no ar".
5. Para encerrar o piloto e voltar ao comportamento normal de produção,
   basta remover `PILOT_MODE_ENABLED` (ou defini-la como `false`) — não é
   necessário nenhum outro passo de rollback, já que o gate foi desenhado
   para ser um no-op completo quando desligado.

## 3. Monitoramento forte

O CLAUDE.md pede "monitoramento forte" para esta fase, sem especificar
métricas ou thresholds novos. Este repositório já produz, desde a Fase 8b,
a base de observabilidade que deve ser usada durante o piloto (ver
`docs/slo/slos.md` e os alertas Terraform em
`infrastructure/terraform/modules/passasorte-stack/monitoring.tf`) — a
Fase 9 não introduz uma stack de monitoramento separada, e sim um uso mais
atento da que já existe:

- Acompanhar os SLOs já definidos (latência, taxa de erro) com atenção
  redobrada durante a janela do piloto, já que o volume será pequeno o
  suficiente para que qualquer anomalia isolada seja proporcionalmente
  mais visível nos dashboards do que em produção plena.
- Cada tentativa de criação de sala ou publicação de campanha bloqueada
  pelo gate do piloto gera um `ConflictError` (HTTP 409) padrão, que já
  aparece nos logs/rastreamento de erros existentes — não foi criado um
  alerta dedicado para "merchant fora do piloto tentou publicar", porque
  isso é esperado e não é, por si só, uma condição de erro operacional;
  cabe à revisão diária (item 4) observar se esse padrão é frequente o
  suficiente para indicar confusão do lado do merchant.
- Qualquer alerta novo específico do piloto (ex.: "número de salas ativas
  se aproximando do limite configurado") não foi implementado nesta
  sessão — não havia uma tarefa de backlog pedindo isso e criar um
  alerta novo sem um canal de notificação definido seria inventar escopo;
  se o time decidir que é necessário, deve seguir o mesmo padrão de
  `monitoring.tf` já existente.

## 4. Revisão diária de produto

O CLAUDE.md pede uma "revisão diária de produto" durante o piloto. Este
runbook não prescreve um formato de reunião ou um dono específico (isso é
uma decisão organizacional, não técnica) — apenas lista o que essa revisão
deveria conseguir responder, usando os dados já disponíveis no sistema:

- Quantas salas foram criadas, quantas participações ocorreram e qual foi
  o resultado (via os relatórios/consultas já existentes sobre
  `GameRoom`/`Participation`/`Winner`).
- Se algum merchant do piloto tentou operar fora do que o gate permite
  (tentativas de publicação/criação de sala bloqueadas — ver seção 3).
- Se o limite de salas ativas configurado em `PILOT_MAX_ACTIVE_ROOMS` foi
  atingido em algum momento (o que bloquearia novas salas até que
  alguma das existentes saísse do conjunto de status ativos).
- Feedback qualitativo dos merchants/operadores participantes, coletado
  fora deste sistema.

## Pendências conhecidas

- Nenhum merchant específico, quantidade de merchants piloto, ou valor de
  `PILOT_MAX_ACTIVE_ROOMS` foi decidido nesta sessão — são decisões que
  cabem ao time de produto/operações no momento de configurar o piloto
  real (seção 2).
- Não foi criado um alerta de monitoramento dedicado ao piloto (ex.:
  "perto do limite de salas ativas") — ver justificativa na seção 3.
- A verificação (`pnpm turbo run lint typecheck test build`) do código do
  gate técnico (pilot-policy.ts e os use cases que o consomem) não pôde
  ser executada a partir desta sessão — ver a nota de limitação de
  plataforma na seção correspondente do documento de contexto do projeto
  (`claude/contexto-passasorte.md`). Deve ser rodada no Mac real antes de
  considerar este código pronto para deploy.
