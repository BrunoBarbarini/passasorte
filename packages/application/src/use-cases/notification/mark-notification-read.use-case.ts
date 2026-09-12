import type { Notification } from "@passasorte/domain";
import type { NotificationRepository } from "../../ports/notification-repository.port.js";

export interface MarkNotificationReadCommand {
  notificationId: string;
  userId: string;
}

export class MarkNotificationReadUseCase {
  constructor(private readonly notifications: NotificationRepository) {}

  execute(command: MarkNotificationReadCommand): Promise<Notification> {
    return this.notifications.markRead(command.notificationId, command.userId);
  }
}
