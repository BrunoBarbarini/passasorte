import { Module } from "@nestjs/common";
import { InfrastructureModule } from "../../infrastructure/infrastructure.module.js";
import { BenefitsController } from "./benefits.controller.js";

@Module({
  imports: [InfrastructureModule],
  controllers: [BenefitsController],
})
export class BenefitsModule {}
