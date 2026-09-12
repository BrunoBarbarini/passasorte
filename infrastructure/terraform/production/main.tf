/**
 * Production environment wrapper - instantiates the passasorte-stack module
 * (../modules/passasorte-stack) with environment_name = "production".
 *
 * NEVER APPLIED: there is no real GCP project id, no state backend, and no
 * CI credentials wired to this directory. `gcp_project_id`, `api_image` and
 * `worker_image` have no defaults anywhere in the module on purpose - they
 * must be supplied via terraform.tfvars (see terraform.tfvars.example in
 * this directory) or -var/-var-file at apply time, and must be real values,
 * never invented ones.
 */

terraform {
  required_version = ">= 1.7.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.30"
    }
  }

  # Remote state backend placeholder. No GCS bucket for Terraform state
  # exists yet - this is commented out until a real bucket is created
  # out-of-band (Terraform can't create the bucket that stores its own
  # state in the same config without a bootstrapping step). Uncomment and
  # fill in once that bucket exists:
  #
  # backend "gcs" {
  #   bucket = "REPLACE-WITH-REAL-TFSTATE-BUCKET"
  #   prefix = "passasorte/production"
  # }
}

provider "google" {
  project = var.gcp_project_id
  region  = var.gcp_region
}

module "stack" {
  source = "../modules/passasorte-stack"

  environment_name = "production"
  gcp_project_id   = var.gcp_project_id
  gcp_region       = var.gcp_region
  api_image        = var.api_image
  worker_image     = var.worker_image

  # Production defaults: keep the API warm (avoid cold starts on real
  # traffic) and keep the uptime check + full alerting on.
  api_min_instances    = 1
  api_max_instances    = 10
  worker_min_instances = 1
  worker_max_instances = 1
  redis_tier           = "STANDARD_HA"
  redis_memory_size_gb = 1
  enable_uptime_check  = true

  # Empty until a real notification channel (email/Slack/PagerDuty) is
  # provisioned - see main.tf's "inert until configured" note.
  alert_notification_channels = var.alert_notification_channels
}
