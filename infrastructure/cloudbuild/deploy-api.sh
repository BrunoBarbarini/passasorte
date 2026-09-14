#!/usr/bin/env bash
# infrastructure/cloudbuild/deploy-api.sh
#
# Primeiro deploy publico do apps/api no Cloud Run, feito a mao (nao e um
# script disparado por CI - CLAUDE.md nao tem pipeline de deploy definido
# ainda). Rode este arquivo no Terminal real do Mac, na raiz do repo, com
# o gcloud ja configurado (gcloud init) e apontando para o projeto
# "passasorte".
#
# Segredos (DATABASE_URL/SUPABASE_URL) NAO ficam neste arquivo (ele e
# versionado no git) - ficam em
# infrastructure/cloudbuild/deploy-api.local.env, que e gitignored e e
# carregado abaixo se existir. Rode o setup abaixo uma vez para criar
# esse arquivo local:
#
#   cat > infrastructure/cloudbuild/deploy-api.local.env <<'ENVEOF'
#   DATABASE_URL="postgresql://usuario:senha@host:porta/postgres"
#   SUPABASE_URL="https://<seu-projeto>.supabase.co"
#   ENVEOF
#
# REDIS_URL fica com um valor placeholder de proposito: Redis nao e
# realmente usado em nenhum lugar do codigo hoje (so no Terraform,
# especulativo da Fase 8b) - so existe aqui porque o schema de env
# (packages/config/src/env.schema.ts) exige a variavel para o processo
# subir. Ver comentario no Dockerfile.

set -euo pipefail

PROJECT_ID="passasorte"
REGION="us-central1"
REPO="passasorte"
SERVICE="passasorte-api"

LOCAL_ENV_FILE="$(dirname "$0")/deploy-api.local.env"
if [[ -f "$LOCAL_ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$LOCAL_ENV_FILE"
fi

DATABASE_URL="${DATABASE_URL:-COLE_AQUI_A_DATABASE_URL_DO_SUPABASE}"
SUPABASE_URL="${SUPABASE_URL:-COLE_AQUI_A_SUPABASE_URL}"
REDIS_URL="redis://placeholder:6379"

if [[ "$DATABASE_URL" == "COLE_AQUI_A_DATABASE_URL_DO_SUPABASE" ]]; then
  echo "Crie infrastructure/cloudbuild/deploy-api.local.env com DATABASE_URL e SUPABASE_URL antes de rodar (ver comentario no topo deste arquivo)." >&2
  exit 1
fi

gcloud config set project "$PROJECT_ID"

# APIs necessarias para build + deploy.
gcloud services enable \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  artifactregistry.googleapis.com

# Repositorio Docker no Artifact Registry (idempotente - ignora erro se ja existir).
gcloud artifacts repositories create "$REPO" \
  --repository-format=docker \
  --location="$REGION" \
  --description="Imagens do PassaSorte (apps/api)" \
  || echo "Repositorio '$REPO' ja existe, seguindo."

# Build da imagem via Cloud Build (nao precisa de Docker local).
gcloud builds submit \
  --config infrastructure/cloudbuild/api.cloudbuild.yaml \
  .

# Deploy no Cloud Run.
gcloud run deploy "$SERVICE" \
  --image "$REGION-docker.pkg.dev/$PROJECT_ID/$REPO/passasorte-api:latest" \
  --region "$REGION" \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --set-env-vars "NODE_ENV=production,SERVICE_NAME=passasorte-api,DATABASE_URL=$DATABASE_URL,SUPABASE_URL=$SUPABASE_URL,REDIS_URL=$REDIS_URL"

echo "---"
echo "Deploy concluido. URL do servico:"
gcloud run services describe "$SERVICE" --region "$REGION" --format='value(status.url)'
