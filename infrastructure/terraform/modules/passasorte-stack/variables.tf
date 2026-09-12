variable "environment_name" {
  description = "Environment identifier (e.g. \"staging\", \"production\"). Used to name and tag every resource."
  type        = string
}

variable "gcp_project_id" {
  description = "GCP project id to deploy into. No default on purpose — this must be an explicit, real project id, never invented."
  type        = string
}

variable "gcp_region" {
  description = "GCP region for regional resources (Cloud Run, Memorystore, Artifact Registry)."
  type        = string
  default     = "southamerica-east1"
}

variable "api_image" {
  description = "Container image reference for apps/api (e.g. REGION-docker.pkg.dev/PROJECT/passasorte/api:TAG)."
  type        = string
}

variable "worker_image" {
  description = "Container image reference for apps/worker."
  type        = string
}

variable "api_min_instances" {
  description = "Minimum Cloud Run instances for the API. 0 allows scale-to-zero (cheaper, cold starts); >=1 avoids cold starts."
  type        = number
  default     = 0
}

variable "api_max_instances" {
  description = "Maximum Cloud Run instances for the API, as a cost/blast-radius ceiling."
  type        = number
  default     = 10
}

variable "worker_min_instances" {
  description = "The worker is a long-lived poller (WORKER_POLL_INTERVAL_MS), not a request-driven service, so this is normally exactly 1 - Cloud Run Jobs/Services running >1 replica of the worker would double-process the same outbox/hold-expiry work unless a distributed lock is added, which does not exist yet."
  type        = number
  default     = 1
}

variable "worker_max_instances" {
  type    = number
  default = 1
}

variable "redis_tier" {
  description = "Memorystore (Redis) tier. BASIC has no HA/failover - fine for a cache that is explicitly never the source of truth (ADR-013)."
  type        = string
  default     = "BASIC"
}

variable "redis_memory_size_gb" {
  type    = number
  default = 1
}

variable "enable_uptime_check" {
  description = "Whether to provision the Cloud Monitoring uptime check + alert policy for /health. Kept as a variable so staging can disable it if noisy."
  type        = bool
  default     = true
}

variable "alert_notification_channels" {
  description = "Cloud Monitoring notification channel IDs (email/Slack/PagerDuty) to attach to every alert policy. Empty by default - alerts are DEFINED but silent until a real channel is configured, same \"inert until configured\" pattern used for notification providers (Phase 5) and the analytics adapter (Phase 8)."
  type        = list(string)
  default     = []
}
