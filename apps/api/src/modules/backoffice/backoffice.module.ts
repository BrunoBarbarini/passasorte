import { Module } from "@nestjs/common";
import { InfrastructureModule } from "../../infrastructure/infrastructure.module.js";
import { BackofficeController } from "./backoffice.controller.js";

@Module({
  imports: [InfrastructureModule],
  controllers: [BackofficeController],
})
export class BackofficeModule {}
