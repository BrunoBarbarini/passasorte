import { MiddlewareConsumer, Module, type NestModule } from "@nestjs/common";
import { HealthController } from "./health/health.controller.js";
import { RequestContextMiddleware } from "./common/request-context.middleware.js";
import { MerchantsModule } from "./modules/merchants/merchants.module.js";
import { ExperiencesModule } from "./modules/experiences/experiences.module.js";
import { CampaignsModule } from "./modules/campaigns/campaigns.module.js";
import { CatalogModule } from "./modules/catalog/catalog.module.js";
import { RoomsModule } from "./modules/rooms/rooms.module.js";
import { ParticipationsModule } from "./modules/participations/participations.module.js";
import { NotificationsModule } from "./modules/notifications/notifications.module.js";
import { OperationsModule } from "./modules/operations/operations.module.js";
import { BenefitsModule } from "./modules/benefits/benefits.module.js";
import { BackofficeModule } from "./modules/backoffice/backoffice.module.js";

@Module({
  imports: [
    MerchantsModule,
    ExperiencesModule,
    CampaignsModule,
    CatalogModule,
    RoomsModule,
    ParticipationsModule,
    NotificationsModule,
    OperationsModule,
    BenefitsModule,
    BackofficeModule,
  ],
  controllers: [HealthController],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes("*");
  }
}
