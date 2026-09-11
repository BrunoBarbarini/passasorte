import { Module } from "@nestjs/common";
import { InfrastructureModule } from "../../infrastructure/infrastructure.module.js";
import { ExperiencesController } from "./experiences.controller.js";

@Module({
  imports: [InfrastructureModule],
  controllers: [ExperiencesController],
})
export class ExperiencesModule {}
