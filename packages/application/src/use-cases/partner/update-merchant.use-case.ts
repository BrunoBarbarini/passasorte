import type { Merchant } from "@passasorte/domain";
import type { AuditLogPort } from "../../ports/audit-log.port.js";
import type { MerchantRepository, UpdateMerchantInput } from "../../ports/merchant-repository.port.js";
import { NotFoundError, ValidationError } from "../../errors.js";

export interface UpdateMerchantCommand extends UpdateMerchantInput {
  merchantId: string;
  actorUserId: string;
}

/** FR-010 Merchant Management: update. */
export class UpdateMerchantUseCase {
  constructor(
    private readonly merchantRepository: MerchantRepository,
    private readonly auditLog: AuditLogPort,
  ) {}

  async execute(command: UpdateMerchantCommand): Promise<Merchant> {
    const existing = await this.merchantRepository.findById(command.merchantId);
    if (!existing) {
      throw new NotFoundError("Merchant", command.merchantId);
    }
    if (command.legalName !== undefined && !command.legalName.trim()) {
      throw new ValidationError("Razão social não pode ficar em branco.", { field: "legalName" });
    }
    if (command.displayName !== undefined && !command.displayName.trim()) {
      throw new ValidationError("Nome de exibição não pode ficar em branco.", {
        field: "displayName",
      });
    }

    const merchant = await this.merchantRepository.update(command.merchantId, {
      legalName: command.legalName?.trim(),
      displayName: command.displayName?.trim(),
    });

    await this.auditLog.record({
      actorUserId: command.actorUserId,
      action: "merchant.updated",
      entityType: "Merchant",
      entityId: merchant.id,
    });

    return merchant;
  }
}
