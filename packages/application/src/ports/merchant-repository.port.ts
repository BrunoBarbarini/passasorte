import type { Merchant, MerchantLocation, MerchantStatus } from "@passasorte/domain";

export interface CreateMerchantInput {
  legalName: string;
  displayName: string;
}

export interface UpdateMerchantInput {
  legalName?: string;
  displayName?: string;
}

export interface CreateMerchantLocationInput {
  merchantId: string;
  label: string;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  state: string;
  postalCode: string;
  country?: string;
}

export interface MerchantRepository {
  /** Backoffice-only read: every merchant, newest first (no pagination yet - small dataset). */
  list(): Promise<Merchant[]>;
  findById(id: string): Promise<Merchant | null>;
  create(input: CreateMerchantInput): Promise<Merchant>;
  update(id: string, input: UpdateMerchantInput): Promise<Merchant>;
  setStatus(id: string, status: MerchantStatus): Promise<Merchant>;
  addLocation(input: CreateMerchantLocationInput): Promise<MerchantLocation>;
  listLocations(merchantId: string): Promise<MerchantLocation[]>;
}
