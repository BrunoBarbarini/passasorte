import {
  assertValidPositionSelectionConfig,
  InvalidPositionSelectionConfigError,
  type PositionSelectionRoomConfig,
} from "@passasorte/domain";
import { ValidationError } from "../../errors.js";

/** Domain validation of the per-room selection settings, surfaced as a 400 with a pt-BR message. */
export function validatePositionSelectionConfig(config: PositionSelectionRoomConfig): void {
  try {
    assertValidPositionSelectionConfig(config);
  } catch (error) {
    if (error instanceof InvalidPositionSelectionConfigError) {
      throw new ValidationError(error.message, { field: "positionSelectionConfig" });
    }
    throw error;
  }
}
