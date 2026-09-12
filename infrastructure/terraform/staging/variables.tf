variable "gcp_project_id" {
  description = "Real GCP project id for staging. No default - must never be invented. May be the same project as production with a different name_prefix, or a separate project - that decision belongs to whoever provisions this for real."
  type        = string
}

variable "gcp_region" {
  type    = string
  default = "southamerica-east1"
}

variable "api_image" {
  type        = string
  description = "Container image reference for apps/api."
}

variable "worker_image" {
  type        = string
  description = "Container image reference for apps/worker."
}

variable "alert_notification_channels" {
  type    = list(string)
  default = []
}
