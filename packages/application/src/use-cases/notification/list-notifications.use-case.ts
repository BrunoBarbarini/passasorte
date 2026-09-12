import type { Notification } from "@passasorte/domain";
import type { NotificationRepository } from "../../ports/notification-repository.port.js";

export interface ListNotificationsCommand {
  userId: string;
  unreadOnly?: boolean;
}

/** FR-059 In-App Notifications: a participant's own notification inbox. */
export class ListNotificationsUseCase {
  constructor(private readonly notifications: NotificationRepository) {}

  execute(command: ListNotificationsCommand): Promise<readonly Notification[]> {
    return this.notifications.listByUser(command.userId, { unreadOnly: command.unreadOnly });
  }
}
