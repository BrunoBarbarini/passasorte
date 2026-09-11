import { Injectable } from "@nestjs/common";
import type { Campaign, ExperienceSnapshot } from "@passasorte/domain";
import type {
  CampaignListFilter,
  CampaignListPage,
  CampaignRepository,
  CreateCampaignInput,
  TransitionCampaignInput,
  UpdateCampaignDraftInput,
} from "@passasorte/application";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma.service.js";
import type { Campaign as PrismaCampaign } from "@prisma/client";

function toDomainCampaign(row: PrismaCampaign): Campaign {
  return {
    id: row.id,
    merchantId: row.merchantId,
    experienceId: row.experienceId,
    title: row.title,
    status: row.status,
    timezone: row.timezone,
    experienceSnapshot: (row.experienceSnapshot as ExperienceSnapshot | null) ?? null,
    scheduledStartAt: row.scheduledStartAt,
    scheduledEndAt: row.scheduledEndAt,
    publishedAt: row.publishedAt,
    endedAt: row.endedAt,
    cancelledAt: row.cancelledAt,
    cancellationReason: row.cancellationReason,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

@Injectable()
export class PrismaCampaignRepository implements CampaignRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Campaign | null> {
    const row = await this.prisma.campaign.findUnique({ where: { id } });
    return row ? toDomainCampaign(row) : null;
  }

  async create(input: CreateCampaignInput): Promise<Campaign> {
    const row = await this.prisma.campaign.create({
      data: {
        merchantId: input.merchantId,
        experienceId: input.experienceId,
        title: input.title,
        timezone: input.timezone ?? undefined,
        scheduledStartAt: input.scheduledStartAt ?? undefined,
        scheduledEndAt: input.scheduledEndAt ?? undefined,
      },
    });
    return toDomainCampaign(row);
  }

  async updateDraft(id: string, input: UpdateCampaignDraftInput): Promise<Campaign> {
    const row = await this.prisma.campaign.update({
      where: { id },
      data: {
        title: input.title,
        timezone: input.timezone,
        scheduledStartAt: input.scheduledStartAt,
        scheduledEndAt: input.scheduledEndAt,
      },
    });
    return toDomainCampaign(row);
  }

  async transition(id: string, input: TransitionCampaignInput): Promise<Campaign> {
    const data: Prisma.CampaignUpdateInput = {
      status: input.status,
      updatedAt: input.at,
    };
    if (input.experienceSnapshot !== undefined) {
      data.experienceSnapshot = (input.experienceSnapshot ?? Prisma.JsonNull) as unknown as Prisma.InputJsonValue;
    }
    if (input.status === "PUBLISHED") data.publishedAt = input.at;
    if (input.status === "ENDED") data.endedAt = input.at;
    if (input.status === "CANCELLED") {
      data.cancelledAt = input.at;
      data.cancellationReason = input.cancellationReason ?? undefined;
    }

    const row = await this.prisma.campaign.update({ where: { id }, data });
    return toDomainCampaign(row);
  }

  async listPublished(filter: CampaignListFilter): Promise<CampaignListPage> {
    const rows = await this.prisma.campaign.findMany({
      where: {
        status: filter.statuses ? { in: filter.statuses } : undefined,
        merchantId: filter.merchantId,
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: filter.limit + 1,
      ...(filter.cursor ? { cursor: { id: filter.cursor }, skip: 1 } : {}),
    });

    const hasMore = rows.length > filter.limit;
    const page = hasMore ? rows.slice(0, filter.limit) : rows;

    return {
      items: page.map(toDomainCampaign),
      nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
    };
  }
}
