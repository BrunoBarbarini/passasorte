# apps/api/Dockerfile
#
# Primeiro deploy publico do apps/api (NestJS + Fastify, ESM) no Cloud Run.
# CLAUDE.md nao definia essa infra ainda (nenhum Dockerfile existia); este
# arquivo e puramente tecnico - nao inventa nenhuma regra de negocio.
#
# Simplificacao deliberada deste primeiro deploy: REDIS_URL e exigido pelo
# schema de env (packages/config/src/env.schema.ts) mas Redis nao e
# efetivamente usado em nenhum lugar do codigo real hoje (so existe no
# Terraform, escrito de forma especulativa na Fase 8b) - por isso o deploy
# usa um valor placeholder para REDIS_URL em vez de provisionar Memorystore
# agora. Cloud Tasks e GCS tem o mesmo status (so Terraform, sem uso real).
# Infra real para os tres continua planejada; so nao e necessaria para
# desbloquear este bug (NEXT_PUBLIC_API_BASE_URL) especificamente.
#
# Build multi-stage pensado para o monorepo pnpm + turborepo: instala deps
# do workspace inteiro (lockfile unico), gera o Prisma Client a partir do
# schema na raiz (prisma/schema.prisma - nao existe um por app), builda
# apenas @passasorte/api e os pacotes de workspace dos quais ele depende
# (turbo run build --filter=@passasorte/api...).
#
# Estagio de runtime: copia a arvore /app INTEIRA do estagio de build (em
# vez de escolher arquivo por arquivo). Primeira versao deste Dockerfile
# copiava so node_modules da raiz + package.json/dist de cada pacote, o
# que quebrou em producao: pnpm NAO faz hoist para node_modules da raiz
# por padrao - cada pacote do workspace (apps/api, packages/*) tem seu
# PROPRIO node_modules com os symlinks so das suas dependencias diretas
# (ex.: apps/api/node_modules/@passasorte/observability). Sem copiar o
# node_modules de cada pacote, o Node falhava no boot com
# "Cannot find package '@passasorte/observability'" (ERR_MODULE_NOT_FOUND)
# e o Cloud Run derrubava o container por nao abrir a porta a tempo.
# Copiar a arvore inteira garante a mesma estrutura de symlinks que
# funcionou durante o build - custa uma imagem maior (inclui devDependencies
# e pacotes nao usados como testkit), aceitavel para este primeiro deploy.

FROM node:22-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
# node:22-slim (Debian) nao vem com openssl instalado - sem isso, o
# Prisma nem consegue detectar a versao de libssl no `prisma generate`
# (caiu no fallback "openssl-1.1.x", que essa imagem nao tem) e o Query
# Engine falha no boot em runtime com "libssl.so.1.1: cannot open shared
# object file". Precisa estar aqui em "base", nao so no estagio de
# build, porque o runtime tambem carrega o Query Engine nativo.
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN corepack enable

# ---- deps: instala dependencias usando so os manifests (cache de layer) --
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/analytics/package.json packages/analytics/package.json
COPY packages/api-contract/package.json packages/api-contract/package.json
COPY packages/application/package.json packages/application/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/domain/package.json packages/domain/package.json
COPY packages/observability/package.json packages/observability/package.json
COPY packages/testkit/package.json packages/testkit/package.json
COPY prisma/schema.prisma prisma/schema.prisma
RUN pnpm install --frozen-lockfile

# ---- build: copia o codigo-fonte, gera Prisma Client e builda a API -------
FROM deps AS build
WORKDIR /app
COPY . .
RUN pnpm exec prisma generate --schema=prisma/schema.prisma
RUN pnpm exec turbo run build --filter=@passasorte/api...

# ---- runtime: imagem final, arvore /app inteira do estagio de build -------
FROM base AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0

COPY --from=build /app ./

WORKDIR /app/apps/api

# Cloud Run injeta PORT em runtime (padrao 8080) e sobrescreve qualquer
# valor definido aqui; ENV so serve de fallback para rodar a imagem fora
# do Cloud Run (ex.: `docker run` local).
ENV PORT=8080
EXPOSE 8080

CMD ["node", "--import", "./dist/telemetry-preload.js", "dist/main.js"]
