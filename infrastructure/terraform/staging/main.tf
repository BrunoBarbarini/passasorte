/**
 * Staging environment wrapper - instantiates the passasorte-stack module
 * (../modules/passasorte-stack) with environment_name = "staging" and
 * cheaper/smaller defaults than production (TASK-065).
 *
 * NEVER APPLIED - same caveats as ../production/main.tf: no real GCP
 * project id, no state backend, no CI credentials wired here.
 */

terraform {
  required_version = ">= 1.7.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.30"
    }
  }

  # backend "gcs" {
  #   bucket = "REPLACE-WITH-REAL-TFSTATE-BUCKET"
  #   prefix = "passasorte/staging"
  # }
}

provider "google" {
  project = var.gcp_project_id
  region  = var.gcp_region
}

module "stack" {
  source = "../modules/passasorte-stack"

  environment_name = "staging"
  gcp_project_id   = var.gcp_project_id
  gcp_region       = var.gcp_region
  api_image        = var.api_image
  worker_image     = var.worker_image

  # Staging defaults: scale-to-zero (cheaper, cold starts acceptable for a
  # non-production environment), smaller max ceiling, BASIC redis tier
  # (no HA needed for staging), uptime check off by default to avoid noisy
  # alerts on an environment that's expected to be idle/down often.
  api_min_instances    = 0
  api_max_instances    = 3
  worker_min_instances = 1
  worker_max_instances = 1
  redis_tier           = "BASIC"
  redis_memory_size_gb = 1
  enable_uptime_check  = false

  alert_notification_channels = var.alert_notification_channels
}
