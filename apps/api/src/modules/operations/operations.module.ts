import { Module } from "@nestjs/common";
import { InfrastructureModule } from "../../infrastructure/infrastructure.module.js";
import { OperationsController } from "./operations.controller.js";

@Module({
  imports: [InfrastructureModule],
  controllers: [OperationsController],
})
export class OperationsModule {}
