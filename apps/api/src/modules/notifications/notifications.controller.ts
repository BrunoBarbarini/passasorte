import { Body, Controller, Get, Inject, Param, Post, Query, UseGuards } from "@nestjs/common";
import { SetNotificationPreferenceSchema } from "@passasorte/api-contract";
import {
  ListNotificationsUseCase,
  MarkNotificationReadUseCase,
  SetNotificationPreferenceUseCase,
  type NotificationRepository,
} from "@passasorte/application";
import type { AuthenticatedUser, Notification, NotificationPreference } from "@passasorte/domain";
import { AuthGuard } from "../../common/auth/auth.guard.js";
import { CurrentUser } from "../../common/auth/current-user.decorator.js";
import { NOTIFICATION_REPOSITORY } from "../../common/tokens.js";
import { parseWithSchema } from "../../common/validation/parse-with-schema.js";

/** FR-059 In-App Notifications + FR-062 Notification Preferences. */
@Controller("notifications")
@UseGuards(AuthGuard)
export class NotificationsController {
  constructor(
    @Inject(NOTIFICATION_REPOSITORY) private readonly notifications: NotificationRepository,
  ) {}

  @Get()
  list(
    @Query("unreadOnly") unreadOnly: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<readonly Notification[]> {
    return new ListNotificationsUseCase(this.notifications).execute({
      userId: user.user.id,
      unreadOnly: unreadOnly === "true",
    });
  }

  @Post(":id/read")
  markRead(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser): Promise<Notification> {
    return new MarkNotificationReadUseCase(this.notifications).execute({
      notificationId: id,
      userId: user.user.id,
    });
  }

  @Post("preferences")
  setPreference(
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<NotificationPreference> {
    const input = parseWithSchema(SetNotificationPreferenceSchema, body);
    return new SetNotificationPreferenceUseCase(this.notifications).execute({
      userId: user.user.id,
      channel: input.channel,
      enabled: input.enabled,
    });
  }
}
