import type { Merchant } from "@passasorte/domain";
import type { AuditLogPort } from "../../ports/audit-log.port.js";
import type { CreateMerchantInput, MerchantRepository } from "../../ports/merchant-repository.port.js";
import { ValidationError } from "../../errors.js";

export interface CreateMerchantCommand extends CreateMerchantInput {
  actorUserId: string;
}

/** FR-010 Merchant Management: create. Backoffice-only (OPERATOR/ADMIN). */
export class CreateMerchantUseCase {
  constructor(
    private readonly merchantRepository: MerchantRepository,
    private readonly auditLog: AuditLogPort,
  ) {}

  async execute(command: CreateMerchantCommand): Promise<Merchant> {
    if (!command.legalName.trim()) {
      throw new ValidationError("Razão social é obrigatória.", { field: "legalName" });
    }
    if (!command.displayName.trim()) {
      throw new ValidationError("Nome de exibição é obrigatório.", { field: "displayName" });
    }

    const merchant = await this.merchantRepository.create({
      legalName: command.legalName.trim(),
      displayName: command.displayName.trim(),
    });

    await this.auditLog.record({
      actorUserId: command.actorUserId,
      action: "merchant.created",
      entityType: "Merchant",
      entityId: merchant.id,
    });

    return merchant;
  }
}
