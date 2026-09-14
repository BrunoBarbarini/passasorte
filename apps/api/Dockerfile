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
# (turbo run build --filter=@passasorte/api...), e a imagem final mantem a
# mesma estrutura de diretorios do monorepo (node_modules com os symlinks
# pnpm intactos) para os imports "@passasorte/*" continuarem resolvendo em
# runtime sem nenhum bundler adicional.

FROM node:22-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
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

# ---- runtime: imagem final, so com o que roda em producao -----------------
FROM base AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=build /app/prisma ./prisma

COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/api/dist ./apps/api/dist

COPY --from=build /app/packages/analytics/package.json ./packages/analytics/package.json
COPY --from=build /app/packages/analytics/dist ./packages/analytics/dist
COPY --from=build /app/packages/api-contract/package.json ./packages/api-contract/package.json
COPY --from=build /app/packages/api-contract/dist ./packages/api-contract/dist
COPY --from=build /app/packages/application/package.json ./packages/application/package.json
COPY --from=build /app/packages/application/dist ./packages/application/dist
COPY --from=build /app/packages/config/package.json ./packages/config/package.json
COPY --from=build /app/packages/config/dist ./packages/config/dist
COPY --from=build /app/packages/domain/package.json ./packages/domain/package.json
COPY --from=build /app/packages/domain/dist ./packages/domain/dist
COPY --from=build /app/packages/observability/package.json ./packages/observability/package.json
COPY --from=build /app/packages/observability/dist ./packages/observability/dist

WORKDIR /app/apps/api

# Cloud Run injeta PORT em runtime (padrao 8080) e sobrescreve qualquer
# valor definido aqui; ENV so serve de fallback para rodar a imagem fora
# do Cloud Run (ex.: `docker run` local).
ENV PORT=8080
EXPOSE 8080

CMD ["node", "--import", "./dist/telemetry-preload.js", "dist/main.js"]
