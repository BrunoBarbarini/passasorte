import type { Merchant, MerchantStatus } from "@passasorte/domain";
import type { AuditLogPort } from "../../ports/audit-log.port.js";
import type { MerchantRepository } from "../../ports/merchant-repository.port.js";
import { NotFoundError } from "../../errors.js";

export interface SetMerchantStatusCommand {
  merchantId: string;
  status: MerchantStatus;
  actorUserId: string;
}

/** FR-010: activate/deactivate a merchant. */
export class SetMerchantStatusUseCase {
  constructor(
    private readonly merchantRepository: MerchantRepository,
    private readonly auditLog: AuditLogPort,
  ) {}

  async execute(command: SetMerchantStatusCommand): Promise<Merchant> {
    const existing = await this.merchantRepository.findById(command.merchantId);
    if (!existing) {
      throw new NotFoundError("Merchant", command.merchantId);
    }

    const merchant = await this.merchantRepository.setStatus(command.merchantId, command.status);

    await this.auditLog.record({
      actorUserId: command.actorUserId,
      action: command.status === "ACTIVE" ? "merchant.activated" : "merchant.deactivated",
      entityType: "Merchant",
      entityId: merchant.id,
    });

    return merchant;
  }
}
