import type { MerchantLocation } from "@passasorte/domain";
import type {
  CreateMerchantLocationInput,
  MerchantRepository,
} from "../../ports/merchant-repository.port.js";
import { NotFoundError, ValidationError } from "../../errors.js";

export interface AddMerchantLocationCommand extends CreateMerchantLocationInput {
  actorUserId: string;
}

/** FR-011 Merchant Locations. */
export class AddMerchantLocationUseCase {
  constructor(private readonly merchantRepository: MerchantRepository) {}

  async execute(command: AddMerchantLocationCommand): Promise<MerchantLocation> {
    const merchant = await this.merchantRepository.findById(command.merchantId);
    if (!merchant) {
      throw new NotFoundError("Merchant", command.merchantId);
    }
    for (const [field, value] of Object.entries({
      label: command.label,
      addressLine1: command.addressLine1,
      city: command.city,
      state: command.state,
      postalCode: command.postalCode,
    })) {
      if (!value.trim()) {
        throw new ValidationError(`O campo "${field}" é obrigatório.`, { field });
      }
    }

    return this.merchantRepository.addLocation(command);
  }
}
