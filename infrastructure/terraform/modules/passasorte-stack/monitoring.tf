/**
 * TASK-067 (SLO Dashboards, partial - the alert-policy half) and TASK-068
 * (Operational Alerts). Everything here is gated by var.enable_uptime_check
 * and reads var.alert_notification_channels, which defaults to an empty
 * list - policies are DEFINED but silent (no channel attached) until a real
 * channel is configured, same "inert until configured" pattern as the
 * notification-provider registry (Phase 5) and the analytics adapter
 * (Phase 8). Never applied against a real GCP project (see main.tf header).
 */

resource "google_monitoring_uptime_check_config" "api_health" {
  count        = var.enable_uptime_check ? 1 : 0
  project      = var.gcp_project_id
  display_name = "${local.name_prefix}-api-health"
  timeout      = "10s"
  period       = "60s"

  http_check {
    path         = "/health"
    port         = 443
    use_ssl      = true
    validate_ssl = true
  }

  monitored_resource {
    type = "uptime_url"
    labels = {
      project_id = var.gcp_project_id
      host       = replace(replace(google_cloud_run_v2_service.api.uri, "https://", ""), "http://", "")
    }
  }
}

resource "google_monitoring_alert_policy" "api_uptime_failure" {
  count        = var.enable_uptime_check ? 1 : 0
  project      = var.gcp_project_id
  display_name = "${local.name_prefix}-api-uptime-failure"
  combiner     = "OR"

  conditions {
    display_name = "apps/api /health uptime check failing"
    condition_threshold {
      filter          = "resource.type=\"uptime_url\" AND metric.type=\"monitoring.googleapis.com/uptime_check/check_passed\" AND metric.label.\"check_id\"=\"${google_monitoring_uptime_check_config.api_health[0].uptime_check_id}\""
      comparison      = "COMPARISON_LT"
      threshold_value = 1
      duration        = "300s"

      aggregations {
        alignment_period   = "300s"
        per_series_aligner = "ALIGN_FRACTION_TRUE"
      }
    }
  }

  notification_channels = var.alert_notification_channels

  documentation {
    content   = "apps/api /health uptime check has failed for 5+ minutes in ${var.environment_name}. See CLAUDE.md's runbooks (docs/runbooks/) for triage steps."
    mime_type = "text/markdown"
  }
}

resource "google_monitoring_alert_policy" "api_error_rate" {
  project      = var.gcp_project_id
  display_name = "${local.name_prefix}-api-5xx-error-rate"
  combiner     = "OR"

  conditions {
    display_name = "apps/api Cloud Run 5xx response rate elevated"
    condition_threshold {
      filter          = "resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"${google_cloud_run_v2_service.api.name}\" AND metric.type=\"run.googleapis.com/request_count\" AND metric.label.\"response_code_class\"=\"5xx\""
      comparison      = "COMPARISON_GT"
      threshold_value = 5
      duration        = "300s"

      aggregations {
        alignment_period   = "300s"
        per_series_aligner = "ALIGN_RATE"
      }
    }
  }

  notification_channels = var.alert_notification_channels

  documentation {
    content   = "apps/api is returning more than 5 5xx responses/sec (5-minute window) in ${var.environment_name}. UNEXPECTED_ERROR responses map to this - check apps/api logs for the underlying stack trace (GlobalHttpExceptionFilter logs full detail server-side even though the client only sees a generic message)."
    mime_type = "text/markdown"
  }
}

resource "google_monitoring_alert_policy" "worker_no_activity" {
  project      = var.gcp_project_id
  display_name = "${local.name_prefix}-worker-no-log-activity"
  combiner     = "OR"

  conditions {
    display_name = "apps/worker has not emitted logs recently (poller may have died)"
    condition_threshold {
      filter          = "resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"${google_cloud_run_v2_service.worker.name}\" AND metric.type=\"logging.googleapis.com/log_entry_count\""
      comparison      = "COMPARISON_LT"
      threshold_value = 1
      duration        = "900s"

      aggregations {
        alignment_period   = "900s"
        per_series_aligner = "ALIGN_COUNT"
      }
    }
  }

  notification_channels = var.alert_notification_channels

  documentation {
    content   = "apps/worker (single always-on poller, WORKER_POLL_INTERVAL_MS) has produced no log entries for 15+ minutes in ${var.environment_name}. Since it is pinned to exactly 1 instance, this likely means the process crashed and Cloud Run has not yet restarted it, or restarted it into a crash loop."
    mime_type = "text/markdown"
  }
}
