/**
 * CLAUDE.md #34: append-only audit trail for mandatory audit actions
 * (role grants, merchant changes, campaign approval/publication/
 * cancellation, ...). Callers pass `actorUserId: null` only for
 * system-initiated actions with no human actor.
 */
export interface RecordAuditLogInput {
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}

export interface AuditLogPort {
  record(input: RecordAuditLogInput): Promise<void>;
}
