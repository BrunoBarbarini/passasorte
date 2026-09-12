/**
 * PassaSorte production/staging stack (TASK-064 Production IaC, TASK-065
 * Staging Environment). Follows CLAUDE.md #46 ("Terraform for Cloud Run,
 * Cloud SQL, Redis, queues, storage, secrets references, monitoring") with
 * one deliberate deviation: no Cloud SQL instance is provisioned here.
 *
 * Why: CLAUDE.md's infra list is an ASSUMPTION written before Phase 1's
 * real, explicit decision (ADR-008 + every phase since) that Postgres is
 * Supabase's own managed instance, not a project-owned Cloud SQL database
 * - every DATABASE_URL in every .env this project has ever used points at
 * Supabase. Provisioning a second, empty Cloud SQL Postgres here would be
 * infra that doesn't match any real decision (CLAUDE.md #58's "don't
 * invent" applies to infrastructure just as much as to business rules).
 * Redis (Memorystore) IS provisioned, matching ADR-013's "Redis as
 * cache/transient state, never source of truth" - it is provisioned ahead
 * of use since nothing in the codebase reads REDIS_URL yet.
 *
 * NEVER APPLIED in this repository: no `terraform apply` (or `plan`) has
 * ever been run against a real GCP project from this codebase - there is
 * no real gcp_project_id, no service account, no state backend configured
 * here. This module is written to compile (`terraform validate`) and to
 * be a correct, reviewable starting point once the user provisions a real
 * GCP project and runs it themselves.
 */

terraform {
  required_version = ">= 1.7.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.30"
    }
  }
}

locals {
  name_prefix = "passasorte-${var.environment_name}"
  common_labels = {
    app         = "passasorte"
    environment = var.environment_name
    managed_by  = "terraform"
  }
}

# ---------------------------------------------------------------------------
# Artifact Registry - container images for apps/api and apps/worker.
# ---------------------------------------------------------------------------
resource "google_artifact_registry_repository" "images" {
  project       = var.gcp_project_id
  location      = var.gcp_region
  repository_id = "${local.name_prefix}-images"
  format        = "DOCKER"
  labels        = local.common_labels
}

# ---------------------------------------------------------------------------
# Secret Manager - references only. Values are set out-of-band (gcloud CLI
# or console) by whoever provisions the real project; Terraform here only
# declares the secret SLOTS that apps/api's env.schema.ts requires, so a
# reviewer can see exactly what production needs without a value ever
# passing through a .tf file or state.
# ---------------------------------------------------------------------------
resource "google_secret_manager_secret" "database_url" {
  project   = var.gcp_project_id
  secret_id = "${local.name_prefix}-database-url"
  labels    = local.common_labels
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret" "supabase_url" {
  project   = var.gcp_project_id
  secret_id = "${local.name_prefix}-supabase-url"
  labels    = local.common_labels
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret" "posthog_api_key" {
  project   = var.gcp_project_id
  secret_id = "${local.name_prefix}-posthog-api-key"
  labels    = local.common_labels
  replication {
    auto {}
  }
}

# ---------------------------------------------------------------------------
# Memorystore (Redis) - cache/transient state only (ADR-013). Not yet read
# by any adapter in the codebase; provisioned ahead of that need so a real
# REDIS_URL exists once one is.
# ---------------------------------------------------------------------------
resource "google_redis_instance" "cache" {
  project        = var.gcp_project_id
  region         = var.gcp_region
  name           = "${local.name_prefix}-cache"
  tier           = var.redis_tier
  memory_size_gb = var.redis_memory_size_gb
  redis_version  = "REDIS_7_2"
  labels         = local.common_labels
}

# ---------------------------------------------------------------------------
# Cloud Tasks - queue reserved for scheduled/delayed operational work
# (CLAUDE.md's ASSUMPTION architecture lists Cloud Tasks alongside Pub/Sub).
# Nothing in the codebase enqueues to Cloud Tasks yet (the scheduler today
# is apps/worker's own setInterval poll, WORKER_POLL_INTERVAL_MS) - this
# queue exists so a future migration to Cloud Tasks-driven scheduling has
# somewhere real to land, without pretending that migration has happened.
# ---------------------------------------------------------------------------
resource "google_cloud_tasks_queue" "operations" {
  project  = var.gcp_project_id
  location = var.gcp_region
  name     = "${local.name_prefix}-operations"
}

# ---------------------------------------------------------------------------
# GCS bucket - reserved for exports/backups (TASK-063 lands its artifacts
# here) and any future file storage (fulfillment attachments, etc).
# ---------------------------------------------------------------------------
resource "google_storage_bucket" "artifacts" {
  project                     = var.gcp_project_id
  name                        = "${local.name_prefix}-artifacts"
  location                    = var.gcp_region
  uniform_bucket_level_access = true
  labels                      = local.common_labels

  lifecycle_rule {
    condition {
      age = 90
    }
    action {
      type = "Delete"
    }
  }
}

# ---------------------------------------------------------------------------
# Cloud Run - apps/api (request-driven, autoscaling).
# ---------------------------------------------------------------------------
resource "google_cloud_run_v2_service" "api" {
  project  = var.gcp_project_id
  location = var.gcp_region
  name     = "${local.name_prefix}-api"
  labels   = local.common_labels

  template {
    scaling {
      min_instance_count = var.api_min_instances
      max_instance_count = var.api_max_instances
    }

    containers {
      image = var.api_image

      ports {
        container_port = 3000
      }

      env {
        name  = "NODE_ENV"
        value = var.environment_name == "production" ? "production" : "staging"
      }
      env {
        name  = "PORT"
        value = "3000"
      }
      env {
        name = "DATABASE_URL"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.database_url.secret_id
            version = "latest"
          }
        }
      }
      env {
        name = "SUPABASE_URL"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.supabase_url.secret_id
            version = "latest"
          }
        }
      }
      env {
        name = "POSTHOG_API_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.posthog_api_key.secret_id
            version = "latest"
          }
        }
      }
      env {
        name  = "REDIS_URL"
        value = "redis://${google_redis_instance.cache.host}:${google_redis_instance.cache.port}"
      }
      # CORS_ALLOWED_ORIGINS, RATE_LIMIT_MAX/WINDOW_MS,
      # REQUIRE_MFA_FOR_PRIVILEGED_ROLES (Phase 8) are left to the real
      # deployer to set per environment - no default is invented here
      # beyond what env.schema.ts itself already defaults to.
    }
  }
}

# ---------------------------------------------------------------------------
# Cloud Run - apps/worker. Deliberately NOT request-driven: it is a single
# always-on instance running its own poll loop (see worker_min/max_instances
# in variables.tf for why replicas must stay at 1 until a distributed lock
# exists).
# ---------------------------------------------------------------------------
resource "google_cloud_run_v2_service" "worker" {
  project  = var.gcp_project_id
  location = var.gcp_region
  name     = "${local.name_prefix}-worker"
  labels   = local.common_labels

  template {
    scaling {
      min_instance_count = var.worker_min_instances
      max_instance_count = var.worker_max_instances
    }

    containers {
      image = var.worker_image

      env {
        name  = "NODE_ENV"
        value = var.environment_name == "production" ? "production" : "staging"
      }
      env {
        name = "DATABASE_URL"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.database_url.secret_id
            version = "latest"
          }
        }
      }
      env {
        name = "SUPABASE_URL"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.supabase_url.secret_id
            version = "latest"
          }
        }
      }
      env {
        name = "POSTHOG_API_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.posthog_api_key.secret_id
            version = "latest"
          }
        }
      }
      # ENABLE_GAME_AUTO_ADVANCE stays whatever the real deployer sets -
      # never forced true here (CLAUDE.md #22 kill switch stays a human
      # decision, not an infra default).
    }
  }
}
