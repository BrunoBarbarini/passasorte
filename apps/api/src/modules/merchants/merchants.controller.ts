import { Body, Controller, Get, Inject, Param, Patch, Post, UseGuards } from "@nestjs/common";
import {
  AddMerchantLocationSchema,
  CreateMerchantSchema,
  SetMerchantStatusSchema,
  UpdateMerchantSchema,
} from "@passasorte/api-contract";
import {
  AddMerchantLocationUseCase,
  CreateMerchantUseCase,
  SetMerchantStatusUseCase,
  UpdateMerchantUseCase,
  type AuditLogPort,
  type MerchantRepository,
} from "@passasorte/application";
import type { AuthenticatedUser, Merchant, MerchantLocation } from "@passasorte/domain";
import { AuthGuard } from "../../common/auth/auth.guard.js";
import { CurrentUser } from "../../common/auth/current-user.decorator.js";
import { Roles } from "../../common/auth/roles.decorator.js";
import { RolesGuard } from "../../common/auth/roles.guard.js";
import { AUDIT_LOG_PORT, MERCHANT_REPOSITORY } from "../../common/tokens.js";
import { parseWithSchema } from "../../common/validation/parse-with-schema.js";

/** FR-010 Merchant Management + FR-011 Merchant Locations. Backoffice-only. */
@Controller("merchants")
@UseGuards(AuthGuard, RolesGuard)
export class MerchantsController {
  private readonly createMerchant: CreateMerchantUseCase;
  private readonly updateMerchant: UpdateMerchantUseCase;
  private readonly setMerchantStatus: SetMerchantStatusUseCase;
  private readonly addMerchantLocation: AddMerchantLocationUseCase;

  constructor(
    @Inject(MERCHANT_REPOSITORY) private readonly merchantRepository: MerchantRepository,
    @Inject(AUDIT_LOG_PORT) auditLog: AuditLogPort,
  ) {
    this.createMerchant = new CreateMerchantUseCase(merchantRepository, auditLog);
    this.updateMerchant = new UpdateMerchantUseCase(merchantRepository, auditLog);
    this.setMerchantStatus = new SetMerchantStatusUseCase(merchantRepository, auditLog);
    this.addMerchantLocation = new AddMerchantLocationUseCase(merchantRepository);
  }

  @Post()
  @Roles("OPERATOR", "ADMIN")
  create(@Body() body: unknown, @CurrentUser() user: AuthenticatedUser): Promise<Merchant> {
    const input = parseWithSchema(CreateMerchantSchema, body);
    return this.createMerchant.execute({ ...input, actorUserId: user.user.id });
  }

  @Patch(":id")
  @Roles("OPERATOR", "ADMIN")
  update(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Merchant> {
    const input = parseWithSchema(UpdateMerchantSchema, body);
    return this.updateMerchant.execute({ ...input, merchantId: id, actorUserId: user.user.id });
  }

  @Patch(":id/status")
  @Roles("OPERATOR", "ADMIN")
  setStatus(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Merchant> {
    const input = parseWithSchema(SetMerchantStatusSchema, body);
    return this.setMerchantStatus.execute({
      merchantId: id,
      status: input.status,
      actorUserId: user.user.id,
    });
  }

  @Post(":id/locations")
  @Roles("OPERATOR", "ADMIN", "MERCHANT_OPERATOR")
  addLocation(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MerchantLocation> {
    const input = parseWithSchema(AddMerchantLocationSchema, body);
    return this.addMerchantLocation.execute({
      ...input,
      merchantId: id,
      actorUserId: user.user.id,
    });
  }

  @Get(":id/locations")
  @Roles("OPERATOR", "ADMIN", "MERCHANT_OPERATOR")
  listLocations(@Param("id") id: string): Promise<MerchantLocation[]> {
    return this.merchantRepository.listLocations(id);
  }
}
