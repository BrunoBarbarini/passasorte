/**
 * FR-010 Merchant Management, FR-011 Merchant Locations. Merchant
 * self-service is not required for MVP (CLAUDE.md #1.7): merchants are
 * created/managed by PassaSorte operators through the backoffice.
 */
export type MerchantStatus = "ACTIVE" | "INACTIVE";

export interface Merchant {
  id: string;
  legalName: string;
  displayName: string;
  status: MerchantStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface MerchantLocation {
  id: string;
  merchantId: string;
  label: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * A merchant can only sponsor a campaign while ACTIVE (BR-002: every
 * commercial campaign references a merchant). Deactivating a merchant
 * does not retroactively affect campaigns already published — it only
 * blocks new ones, which the campaign creation use case enforces by
 * calling this.
 */
export function canSponsorNewCampaign(merchant: Merchant): boolean {
  return merchant.status === "ACTIVE";
}
