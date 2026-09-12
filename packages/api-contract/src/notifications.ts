import { z } from "zod";

export const NOTIFICATION_CHANNELS = ["IN_APP", "PUSH", "EMAIL"] as const;

/** FR-062 Notification Preferences. */
export const SetNotificationPreferenceSchema = z.object({
  channel: z.enum(NOTIFICATION_CHANNELS),
  enabled: z.boolean(),
});
export type SetNotificationPreferenceBody = z.infer<typeof SetNotificationPreferenceSchema>;
