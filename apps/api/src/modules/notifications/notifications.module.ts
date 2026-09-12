import { Module } from "@nestjs/common";
import { InfrastructureModule } from "../../infrastructure/infrastructure.module.js";
import { NotificationsController } from "./notifications.controller.js";

@Module({
  imports: [InfrastructureModule],
  controllers: [NotificationsController],
})
export class NotificationsModule {}
