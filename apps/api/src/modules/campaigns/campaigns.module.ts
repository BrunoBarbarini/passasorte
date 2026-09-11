import { Module } from "@nestjs/common";
import { InfrastructureModule } from "../../infrastructure/infrastructure.module.js";
import { CampaignsController } from "./campaigns.controller.js";

@Module({
  imports: [InfrastructureModule],
  controllers: [CampaignsController],
})
export class CampaignsModule {}
