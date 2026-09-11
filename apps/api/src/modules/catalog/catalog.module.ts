import { Module } from "@nestjs/common";
import { InfrastructureModule } from "../../infrastructure/infrastructure.module.js";
import { CatalogController } from "./catalog.controller.js";

@Module({
  imports: [InfrastructureModule],
  controllers: [CatalogController],
})
export class CatalogModule {}
