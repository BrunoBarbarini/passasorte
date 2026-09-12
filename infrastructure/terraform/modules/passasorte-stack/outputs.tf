output "api_url" {
  description = "Public URL of the apps/api Cloud Run service."
  value       = google_cloud_run_v2_service.api.uri
}

output "worker_service_name" {
  description = "Name of the apps/worker Cloud Run service (worker has no public URL usage expected, but the name is useful for gcloud/logs filters)."
  value       = google_cloud_run_v2_service.worker.name
}

output "artifact_registry_repository" {
  description = "Full Artifact Registry repository path to push apps/api and apps/worker images to, e.g. `<region>-docker.pkg.dev/<project>/<repo>`."
  value       = "${var.gcp_region}-docker.pkg.dev/${var.gcp_project_id}/${google_artifact_registry_repository.images.repository_id}"
}

output "redis_host" {
  description = "Memorystore (Redis) instance host. Not yet consumed by any adapter in the codebase (ADR-013: Redis is cache/transient state only, never source of truth)."
  value       = google_redis_instance.cache.host
}

output "redis_port" {
  description = "Memorystore (Redis) instance port."
  value       = google_redis_instance.cache.port
}

output "storage_bucket_name" {
  description = "GCS bucket reserved for backup/export artifacts (TASK-063) and future file storage."
  value       = google_storage_bucket.artifacts.name
}

output "cloud_tasks_queue_id" {
  description = "Cloud Tasks queue id, reserved for a future migration away from apps/worker's in-process poll loop. Nothing enqueues to it today."
  value       = google_cloud_tasks_queue.operations.id
}

output "secret_ids" {
  description = "Secret Manager secret IDs (slots only - values are never set by Terraform) that a deployer must populate before applying this module for real: database_url, supabase_url, posthog_api_key."
  value = {
    database_url    = google_secret_manager_secret.database_url.secret_id
    supabase_url    = google_secret_manager_secret.supabase_url.secret_id
    posthog_api_key = google_secret_manager_secret.posthog_api_key.secret_id
  }
}
