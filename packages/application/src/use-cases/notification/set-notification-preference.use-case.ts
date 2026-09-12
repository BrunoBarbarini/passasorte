import type { NotificationChannel, NotificationPreference } from "@passasorte/domain";
import type { NotificationRepository } from "../../ports/notification-repository.port.js";

export interface SetNotificationPreferenceCommand {
  userId: string;
  channel: NotificationChannel;
  enabled: boolean;
}

/** FR-062 Notification Preferences. */
export class SetNotificationPreferenceUseCase {
  constructor(private readonly notifications: NotificationRepository) {}

  execute(command: SetNotificationPreferenceCommand): Promise<NotificationPreference> {
    return this.notifications.setPreference(command.userId, command.channel, command.enabled);
  }
}
