import { Injectable } from "@nestjs/common";
import type { Merchant, MerchantLocation, MerchantStatus } from "@passasorte/domain";
import type {
  CreateMerchantInput,
  CreateMerchantLocationInput,
  MerchantRepository,
  UpdateMerchantInput,
} from "@passasorte/application";
import { PrismaService } from "../prisma.service.js";
import type {
  Merchant as PrismaMerchant,
  MerchantLocation as PrismaMerchantLocation,
} from "@prisma/client";

function toDomainMerchant(row: PrismaMerchant): Merchant {
  return {
    id: row.id,
    legalName: row.legalName,
    displayName: row.displayName,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toDomainLocation(row: PrismaMerchantLocation): MerchantLocation {
  return {
    id: row.id,
    merchantId: row.merchantId,
    label: row.label,
    addressLine1: row.addressLine1,
    addressLine2: row.addressLine2,
    city: row.city,
    state: row.state,
    postalCode: row.postalCode,
    country: row.country,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

@Injectable()
export class PrismaMerchantRepository implements MerchantRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Merchant | null> {
    const row = await this.prisma.merchant.findUnique({ where: { id } });
    return row ? toDomainMerchant(row) : null;
  }

  async create(input: CreateMerchantInput): Promise<Merchant> {
    const row = await this.prisma.merchant.create({ data: input });
    return toDomainMerchant(row);
  }

  async update(id: string, input: UpdateMerchantInput): Promise<Merchant> {
    const row = await this.prisma.merchant.update({ where: { id }, data: input });
    return toDomainMerchant(row);
  }

  async setStatus(id: string, status: MerchantStatus): Promise<Merchant> {
    const row = await this.prisma.merchant.update({ where: { id }, data: { status } });
    return toDomainMerchant(row);
  }

  async addLocation(input: CreateMerchantLocationInput): Promise<MerchantLocation> {
    const row = await this.prisma.merchantLocation.create({
      data: {
        merchantId: input.merchantId,
        label: input.label,
        addressLine1: input.addressLine1,
        addressLine2: input.addressLine2 ?? undefined,
        city: input.city,
        state: input.state,
        postalCode: input.postalCode,
        country: input.country ?? undefined,
      },
    });
    return toDomainLocation(row);
  }

  async listLocations(merchantId: string): Promise<MerchantLocation[]> {
    const rows = await this.prisma.merchantLocation.findMany({ where: { merchantId } });
    return rows.map(toDomainLocation);
  }
}
