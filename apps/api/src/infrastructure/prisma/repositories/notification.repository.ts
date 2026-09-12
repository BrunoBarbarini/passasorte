import { Injectable } from "@nestjs/common";
import type { Notification, NotificationChannel, NotificationPreference } from "@passasorte/domain";
import type { CreateNotificationInput, NotificationRepository } from "@passasorte/application";
import type {
  Notification as PrismaNotification,
  NotificationPreference as PrismaNotificationPreference,
  Prisma,
} from "@prisma/client";
import { PrismaService } from "../prisma.service.js";

function toDomainNotification(row: PrismaNotification): Notification {
  return {
    id: row.id,
    userId: row.userId,
    type: row.type,
    title: row.title,
    body: row.body,
    data: (row.data as Record<string, unknown> | null) ?? null,
    readAt: row.readAt,
    createdAt: row.createdAt,
  };
}

function toDomainPreference(row: PrismaNotificationPreference): NotificationPreference {
  return {
    userId: row.userId,
    channel: row.channel as NotificationChannel,
    enabled: row.enabled,
  };
}

@Injectable()
export class PrismaNotificationRepository implements NotificationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateNotificationInput): Promise<Notification> {
    const row = await this.prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        data: (input.data as Prisma.InputJsonValue) ?? undefined,
      },
    });
    return toDomainNotification(row);
  }

  async listByUser(
    userId: string,
    options?: { unreadOnly?: boolean },
  ): Promise<readonly Notification[]> {
    const rows = await this.prisma.notification.findMany({
      where: { userId, ...(options?.unreadOnly ? { readAt: null } : {}) },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toDomainNotification);
  }

  async markRead(id: string, userId: string): Promise<Notification> {
    const row = await this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
    if (row.userId !== userId) {
      throw new Error("Notificação não pertence a este usuário.");
    }
    return toDomainNotification(row);
  }

  /** FR-062: absence of a row means "enabled" — never invented as a stored default row. */
  async getPreference(
    userId: string,
    channel: NotificationChannel,
  ): Promise<NotificationPreference | null> {
    const row = await this.prisma.notificationPreference.findUnique({
      where: { userId_channel: { userId, channel } },
    });
    return row ? toDomainPreference(row) : null;
  }

  async setPreference(
    userId: string,
    channel: NotificationChannel,
    enabled: boolean,
  ): Promise<NotificationPreference> {
    const row = await this.prisma.notificationPreference.upsert({
      where: { userId_channel: { userId, channel } },
      create: { userId, channel, enabled },
      update: { enabled },
    });
    return toDomainPreference(row);
  }
}
