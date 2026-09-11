/* eslint-disable @typescript-eslint/require-await -- in-memory test fakes intentionally implement async interfaces synchronously */
import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import type {
  Campaign,
  Experience,
  Merchant,
} from "@passasorte/domain";
import type {
  CampaignListFilter,
  CampaignListPage,
  CampaignRepository,
  CreateCampaignInput,
  TransitionCampaignInput,
  UpdateCampaignDraftInput,
} from "../ports/campaign-repository.port.js";
import type {
  CreateExperienceInput,
  ExperienceRepository,
  UpdateExperienceInput,
} from "../ports/experience-repository.port.js";
import type {
  CreateMerchantInput,
  CreateMerchantLocationInput,
  MerchantRepository,
  UpdateMerchantInput,
} from "../ports/merchant-repository.port.js";
import type { AuditLogPort, RecordAuditLogInput } from "../ports/audit-log.port.js";
import type { OutboxPort, PublishOutboxEventInput } from "../ports/outbox.port.js";
import { CreateCampaignUseCase } from "../use-cases/campaign/create-campaign.use-case.js";
import { TransitionCampaignUseCase } from "../use-cases/campaign/transition-campaign.use-case.js";
import { DomainError, ValidationError } from "../errors.js";
import { InvalidCampaignTransitionError } from "@passasorte/domain";

class InMemoryMerchantRepository implements MerchantRepository {
  merchants = new Map<string, Merchant>();

  async findById(id: string) {
    return this.merchants.get(id) ?? null;
  }
  async create(input: CreateMerchantInput) {
    const merchant: Merchant = {
      id: randomUUID(),
      legalName: input.legalName,
      displayName: input.displayName,
      status: "ACTIVE",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.merchants.set(merchant.id, merchant);
    return merchant;
  }
  async update(id: string, input: UpdateMerchantInput) {
    const existing = this.merchants.get(id)!;
    const updated = { ...existing, ...input, updatedAt: new Date() };
    this.merchants.set(id, updated);
    return updated;
  }
  async setStatus(id: string, status: Merchant["status"]) {
    const existing = this.merchants.get(id)!;
    const updated = { ...existing, status };
    this.merchants.set(id, updated);
    return updated;
  }
  async addLocation(input: CreateMerchantLocationInput) {
    return {
      id: randomUUID(),
      merchantId: input.merchantId,
      label: input.label,
      addressLine1: input.addressLine1,
      addressLine2: input.addressLine2 ?? null,
      city: input.city,
      state: input.state,
      postalCode: input.postalCode,
      country: input.country ?? "BR",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
  async listLocations() {
    return [];
  }
}

class InMemoryExperienceRepository implements ExperienceRepository {
  experiences = new Map<string, Experience>();

  async findById(id: string) {
    return this.experiences.get(id) ?? null;
  }
  async create(input: CreateExperienceInput) {
    const experience: Experience = {
      id: randomUUID(),
      merchantId: input.merchantId,
      title: input.title,
      description: input.description,
      status: "DRAFT",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.experiences.set(experience.id, experience);
    return experience;
  }
  async update(id: string, input: UpdateExperienceInput) {
    const existing = this.experiences.get(id)!;
    const updated = { ...existing, ...input, updatedAt: new Date() };
    this.experiences.set(id, updated);
    return updated;
  }
}

class InMemoryCampaignRepository implements CampaignRepository {
  campaigns = new Map<string, Campaign>();

  async findById(id: string) {
    return this.campaigns.get(id) ?? null;
  }
  async create(input: CreateCampaignInput) {
    const campaign: Campaign = {
      id: randomUUID(),
      merchantId: input.merchantId,
      experienceId: input.experienceId,
      title: input.title,
      status: "DRAFT",
      timezone: input.timezone ?? "America/Sao_Paulo",
      experienceSnapshot: null,
      scheduledStartAt: input.scheduledStartAt ?? null,
      scheduledEndAt: input.scheduledEndAt ?? null,
      publishedAt: null,
      endedAt: null,
      cancelledAt: null,
      cancellationReason: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.campaigns.set(campaign.id, campaign);
    return campaign;
  }
  async updateDraft(id: string, input: UpdateCampaignDraftInput) {
    const existing = this.campaigns.get(id)!;
    const updated = { ...existing, ...input, updatedAt: new Date() };
    this.campaigns.set(id, updated);
    return updated;
  }
  async transition(id: string, input: TransitionCampaignInput) {
    const existing = this.campaigns.get(id)!;
    const updated: Campaign = {
      ...existing,
      status: input.status,
      experienceSnapshot: input.experienceSnapshot ?? existing.experienceSnapshot,
      cancellationReason: input.cancellationReason ?? existing.cancellationReason,
      publishedAt: input.status === "PUBLISHED" ? input.at : existing.publishedAt,
      endedAt: input.status === "ENDED" ? input.at : existing.endedAt,
      cancelledAt: input.status === "CANCELLED" ? input.at : existing.cancelledAt,
      updatedAt: input.at,
    };
    this.campaigns.set(id, updated);
    return updated;
  }
  async listPublished(_filter: CampaignListFilter): Promise<CampaignListPage> {
    return { items: [...this.campaigns.values()], nextCursor: null };
  }
}

class InMemoryAuditLog implements AuditLogPort {
  entries: RecordAuditLogInput[] = [];
  async record(input: RecordAuditLogInput) {
    this.entries.push(input);
  }
}

class InMemoryOutbox implements OutboxPort {
  events: PublishOutboxEventInput[] = [];
  async publish(input: PublishOutboxEventInput) {
    this.events.push(input);
  }
}

function setupHarness() {
  const merchantRepository = new InMemoryMerchantRepository();
  const experienceRepository = new InMemoryExperienceRepository();
  const campaignRepository = new InMemoryCampaignRepository();
  const auditLog = new InMemoryAuditLog();
  const outbox = new InMemoryOutbox();

  return { merchantRepository, experienceRepository, campaignRepository, auditLog, outbox };
}

describe("CreateCampaignUseCase", () => {
  it("rejects creating a campaign for an inactive merchant", async () => {
    const h = setupHarness();
    const merchant = await h.merchantRepository.create({ legalName: "A", displayName: "A" });
    await h.merchantRepository.setStatus(merchant.id, "INACTIVE");
    const experience = await h.experienceRepository.create({
      merchantId: merchant.id,
      title: "Jantar",
      description: "Um jantar",
    });

    const useCase = new CreateCampaignUseCase(
      h.campaignRepository,
      h.merchantRepository,
      h.experienceRepository,
      h.auditLog,
    );

    await expect(
      useCase.execute({
        merchantId: merchant.id,
        experienceId: experience.id,
        title: "Campanha",
        actorUserId: "actor-1",
      }),
    ).rejects.toBeInstanceOf(DomainError);
  });

  it("rejects an experience that belongs to a different merchant", async () => {
    const h = setupHarness();
    const merchantA = await h.merchantRepository.create({ legalName: "A", displayName: "A" });
    const merchantB = await h.merchantRepository.create({ legalName: "B", displayName: "B" });
    const experience = await h.experienceRepository.create({
      merchantId: merchantB.id,
      title: "Jantar",
      description: "Um jantar",
    });

    const useCase = new CreateCampaignUseCase(
      h.campaignRepository,
      h.merchantRepository,
      h.experienceRepository,
      h.auditLog,
    );

    await expect(
      useCase.execute({
        merchantId: merchantA.id,
        experienceId: experience.id,
        title: "Campanha",
        actorUserId: "actor-1",
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("creates a DRAFT campaign and records an audit entry", async () => {
    const h = setupHarness();
    const merchant = await h.merchantRepository.create({ legalName: "A", displayName: "A" });
    const experience = await h.experienceRepository.create({
      merchantId: merchant.id,
      title: "Jantar",
      description: "Um jantar",
    });

    const useCase = new CreateCampaignUseCase(
      h.campaignRepository,
      h.merchantRepository,
      h.experienceRepository,
      h.auditLog,
    );

    const campaign = await useCase.execute({
      merchantId: merchant.id,
      experienceId: experience.id,
      title: "Campanha de lançamento",
      actorUserId: "actor-1",
    });

    expect(campaign.status).toBe("DRAFT");
    expect(h.auditLog.entries).toHaveLength(1);
    expect(h.auditLog.entries[0]?.action).toBe("campaign.created");
  });
});

describe("TransitionCampaignUseCase", () => {
  async function createDraftCampaign(h: ReturnType<typeof setupHarness>) {
    const merchant = await h.merchantRepository.create({ legalName: "A", displayName: "A" });
    const experience = await h.experienceRepository.create({
      merchantId: merchant.id,
      title: "Jantar",
      description: "Um jantar especial",
    });
    return h.campaignRepository.create({
      merchantId: merchant.id,
      experienceId: experience.id,
      title: "Campanha",
    });
  }

  it("rejects an illegal transition (DRAFT straight to PUBLISHED)", async () => {
    const h = setupHarness();
    const campaign = await createDraftCampaign(h);
    const useCase = new TransitionCampaignUseCase(
      h.campaignRepository,
      h.experienceRepository,
      h.auditLog,
      h.outbox,
    );

    await expect(
      useCase.execute({
        campaignId: campaign.id,
        targetStatus: "PUBLISHED",
        actorUserId: "actor-1",
      }),
    ).rejects.toBeInstanceOf(InvalidCampaignTransitionError);
  });

  it("requires a cancellation reason when cancelling", async () => {
    const h = setupHarness();
    const campaign = await createDraftCampaign(h);
    const useCase = new TransitionCampaignUseCase(
      h.campaignRepository,
      h.experienceRepository,
      h.auditLog,
      h.outbox,
    );

    await expect(
      useCase.execute({ campaignId: campaign.id, targetStatus: "CANCELLED", actorUserId: "actor-1" }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("freezes an experience snapshot when publishing, records audit + outbox", async () => {
    const h = setupHarness();
    const campaign = await createDraftCampaign(h);
    const useCase = new TransitionCampaignUseCase(
      h.campaignRepository,
      h.experienceRepository,
      h.auditLog,
      h.outbox,
    );

    await useCase.execute({ campaignId: campaign.id, targetStatus: "IN_REVIEW", actorUserId: "a" });
    await useCase.execute({ campaignId: campaign.id, targetStatus: "APPROVED", actorUserId: "a" });
    await useCase.execute({ campaignId: campaign.id, targetStatus: "SCHEDULED", actorUserId: "a" });
    const published = await useCase.execute({
      campaignId: campaign.id,
      targetStatus: "PUBLISHED",
      actorUserId: "a",
    });

    expect(published.status).toBe("PUBLISHED");
    expect(published.experienceSnapshot).not.toBeNull();
    expect(published.experienceSnapshot?.title).toBe("Jantar");
    expect(published.publishedAt).not.toBeNull();
    expect(h.outbox.events.some((e) => e.eventType === "campaign.published")).toBe(true);
    expect(h.auditLog.entries.some((e) => e.action === "campaign.published")).toBe(true);
  });

  it("keeps a published campaign's snapshot untouched by later experience edits", async () => {
    const h = setupHarness();
    const campaign = await createDraftCampaign(h);
    const useCase = new TransitionCampaignUseCase(
      h.campaignRepository,
      h.experienceRepository,
      h.auditLog,
      h.outbox,
    );

    await useCase.execute({ campaignId: campaign.id, targetStatus: "IN_REVIEW", actorUserId: "a" });
    await useCase.execute({ campaignId: campaign.id, targetStatus: "APPROVED", actorUserId: "a" });
    await useCase.execute({ campaignId: campaign.id, targetStatus: "SCHEDULED", actorUserId: "a" });
    const published = await useCase.execute({
      campaignId: campaign.id,
      targetStatus: "PUBLISHED",
      actorUserId: "a",
    });

    await h.experienceRepository.update(campaign.experienceId, { title: "Novo título" });

    expect(published.experienceSnapshot?.title).toBe("Jantar");
  });
});
