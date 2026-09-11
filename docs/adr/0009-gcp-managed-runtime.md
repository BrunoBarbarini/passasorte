# ADR-009: Google Cloud Platform as the managed runtime

## Status

PROPOSED

## Context

CLAUDE.md #13 lists GCP (Cloud Run, Pub/Sub, Cloud Tasks, GCS) and
Terraform for IaC as the assumed cloud stack; #43 requires infra changes
to go through Terraform + PR.

## Decision

Deploy the API/worker to Cloud Run, use Pub/Sub + Cloud Tasks for
async/scheduled work, GCS for object storage, all provisioned via
Terraform.

## Consequences

Managed autoscaling and low ops overhead at MVP scale; ties infra code to
GCP-specific Terraform providers, revisited only if a concrete need
justifies multi-cloud (which CLAUDE.md #12/#52 explicitly discourage
before it's needed).
