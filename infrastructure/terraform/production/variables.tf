variable "gcp_project_id" {
  description = "Real GCP project id for production. No default - must never be invented."
  type        = string
}

variable "gcp_region" {
  type    = string
  default = "southamerica-east1"
}

variable "api_image" {
  description = "Container image reference for apps/api, e.g. produced by .github/workflows/deploy-production.yml."
  type        = string
}

variable "worker_image" {
  description = "Container image reference for apps/worker."
  type        = string
}

variable "alert_notification_channels" {
  description = "Cloud Monitoring notification channel IDs. Empty until a real channel is configured."
  type        = list(string)
  default     = []
}
