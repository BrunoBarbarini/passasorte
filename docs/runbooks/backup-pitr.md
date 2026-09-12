# Runbook: Backup & Point-in-Time Recovery (TASK-063)

## Escopo

Duas coisas distintas, tratadas separadamente porque só uma delas pode ser
validada a partir deste repositório:

1. **Mecânica de dump/restore** (validável localmente) — `pg_dump`/`pg_restore`
   contra o Postgres local do docker-compose.
2. **Point-in-Time Recovery real do Supabase** (não validável a partir deste
   repositório) — depende da infraestrutura gerenciada do Supabase.

## 1. Validação local de dump/restore

Rodar `scripts/ops/validate-backup-restore.sh` (requer o stack local do
docker-compose rodando — `docker compose -f infrastructure/docker/docker-compose.yml up -d`).
O script faz `pg_dump` do banco local, cria um banco de restauração
temporário, restaura o dump nele, compara a contagem de tabelas em
`information_schema.tables` entre origem e destino, e limpa tudo ao final.

Isso valida que a **mecânica** de backup/restore funciona contra o schema
real do projeto (`prisma/schema.prisma`) — não substitui um teste real de
PITR do Supabase.

## 2. Point-in-Time Recovery real (Supabase)

**Nunca executado a partir desta sessão** — não há aqui credenciais do
projeto Supabase com escopo para disparar uma restauração real, e fazê-lo
sem necessidade real arriscaria dados de produção/desenvolvimento.

Procedimento real (a ser seguido por quem tiver acesso ao dashboard do
Supabase, quando/se um teste de PITR real for necessário):

1. Confirmar no dashboard do Supabase (Project Settings → Database →
   Backups) que o projeto tem PITR habilitado e qual é a janela de
   retenção contratada no plano atual.
2. **Nunca testar PITR restaurando por cima do projeto de produção.**
   Usar a opção de restaurar para um branch/projeto separado, se
   disponível no plano, ou testar apenas em um projeto de
   desenvolvimento/staging dedicado.
3. Escolher um timestamp dentro da janela de retenção e disparar a
   restauração pelo dashboard (ou suporte do Supabase, dependendo do
   plano).
4. Validar os dados restaurados contra uma expectativa conhecida (ex.:
   contagem de linhas em tabelas-chave antes/depois, ou um registro
   específico que se sabe que existia naquele momento).
5. Documentar o tempo total do processo (RTO real observado) — isso
   ainda não existe como número medido neste projeto.

## Pendências conhecidas

- Nenhum teste de PITR real do Supabase foi executado — este runbook
  descreve o procedimento, não confirma que ele funciona neste projeto
  específico.
- Não há RPO/RTO formalmente definidos para o Supabase gerenciado do
  PassaSorte — dependem do plano contratado, que não foi informado nesta
  sessão.
