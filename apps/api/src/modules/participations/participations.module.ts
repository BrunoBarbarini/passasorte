import { Module } from "@nestjs/common";
import { InfrastructureModule } from "../../infrastructure/infrastructure.module.js";
import { ParticipationsController } from "./participations.controller.js";

@Module({
  imports: [InfrastructureModule],
  controllers: [ParticipationsController],
})
export class ParticipationsModule {}
