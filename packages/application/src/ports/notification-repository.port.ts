import type { Notification, NotificationChannel, NotificationPreference } from "@passasorte/domain";

export interface CreateNotificationInput {
  userId: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

/** FR-059..FR-062. Only the IN_APP channel is a real, queryable record today (CLAUDE.md #3.12: push/email provider is TBD) — see NotificationProvider for the pluggable dispatch seam. */
export interface NotificationRepository {
  create(input: CreateNotificationInput): Promise<Notification>;
  listByUser(userId: string, options?: { unreadOnly?: boolean }): Promise<readonly Notification[]>;
  markRead(id: string, userId: string): Promise<Notification>;
  /** FR-062: defaults to enabled when no preference row exists yet — see the port's implementations. */
  getPreference(
    userId: string,
    channel: NotificationChannel,
  ): Promise<NotificationPreference | null>;
  setPreference(
    userId: string,
    channel: NotificationChannel,
    enabled: boolean,
  ): Promise<NotificationPreference>;
}
