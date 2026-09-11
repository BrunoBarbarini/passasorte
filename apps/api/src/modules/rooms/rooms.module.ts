import { Module } from "@nestjs/common";
import { InfrastructureModule } from "../../infrastructure/infrastructure.module.js";
import { RoomsController } from "./rooms.controller.js";

@Module({
  imports: [InfrastructureModule],
  controllers: [RoomsController],
})
export class RoomsModule {}
