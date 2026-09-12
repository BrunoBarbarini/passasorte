# SLOs — PassaSorte apps/api (TASK-067)

Status: **definições escritas, nunca medidas contra tráfego real**. Não
existe ainda um workspace de Cloud Monitoring real (nenhum `terraform
apply` foi executado — ver `infrastructure/terraform/modules/passasorte-stack/main.tf`),
então os números abaixo são metas propostas, não SLOs validados
historicamente. Devem ser revisados após as primeiras semanas de tráfego
real em produção.

## Por que apenas `apps/api`

`apps/worker` não atende requisições HTTP (é um poller único, ver
`WORKER_POLL_INTERVAL_MS`) — sua saúde operacional é coberta pelo alerta
`worker_no_activity` em `monitoring.tf`, não por um SLO de latência/erro.

## SLIs e SLOs propostos

### Disponibilidade

- **SLI**: proporção de requisições a `GET /health` que retornam `200` em
  uma janela de 5 minutos (medido pelo uptime check do Cloud Monitoring,
  `google_monitoring_uptime_check_config.api_health`).
- **SLO**: 99.5% de disponibilidade mensal (~3h39min de indisponibilidade
  permitida por mês). Escolhido conservador de propósito — é o primeiro
  ciclo em produção real, sem histórico para calibrar um número mais
  agressivo (99.9%).
- **Alerta**: `google_monitoring_alert_policy.api_uptime_failure` —
  dispara após 5 minutos consecutivos de falha do uptime check.

### Taxa de erro

- **SLI**: proporção de respostas com `response_code_class = 5xx` sobre o
  total de respostas de `apps/api`, por janela de 5 minutos.
- **SLO**: taxa de erro 5xx < 1% em janela de 1 hora (error budget: 43.2
  minutos de erro/mês a 1%, dentro do orçamento de disponibilidade acima).
- **Alerta**: `google_monitoring_alert_policy.api_error_rate` — dispara
  quando a taxa ultrapassa 5 respostas 5xx/segundo (média de 5 minutos) —
  um limiar operacional (ruído alto = investigar agora), não o próprio
  SLO de 1%; o SLO mensal deve ser calculado via relatório, não via este
  alerta.

### Latência

- **SLI**: p95 de latência de resposta HTTP em `apps/api`, por rota.
- **SLO proposto**: p95 < 500ms para rotas de leitura do catálogo
  (`GET /api/v1/campaigns`, `GET /api/v1/merchants/:id`) e p95 < 800ms
  para rotas de escrita/transação (holds, participações). **Não há
  alerta de latência configurado ainda** — nenhuma medição real de
  latência de produção existe para calibrar um limiar sem inventar um
  número; isso fica como pendência explícita (ver seção abaixo) até que
  haja dados reais de `apps/api` em produção ou ao menos em staging sob
  carga (ver `scripts/load-test/`).

## Pendências conhecidas

- Dashboard de série temporal (JSON) para os SLIs acima ainda não foi
  criado nesta pasta — nenhuma ferramenta de dashboard real (Cloud
  Monitoring, Grafana) está provisionada para gerar/validar um JSON
  correto sem arriscar inventar um formato incompatível. Prioridade
  para quando houver um workspace de monitoramento real.
- Alerta de latência p95 fica pendente até existir dado real (local
  load-test em `scripts/load-test/` pode servir de primeira referência,
  mas não substitui tráfego de produção).
- Os alvos de disponibilidade/erro acima devem ser revisados após o
  primeiro mês real de produção — são pontos de partida, não compromissos
  contratuais.
