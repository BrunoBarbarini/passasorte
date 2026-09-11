import { Module } from "@nestjs/common";
import { InfrastructureModule } from "../../infrastructure/infrastructure.module.js";
import { MerchantsController } from "./merchants.controller.js";

@Module({
  imports: [InfrastructureModule],
  controllers: [MerchantsController],
})
export class MerchantsModule {}
