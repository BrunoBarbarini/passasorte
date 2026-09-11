import { MiddlewareConsumer, Module, type NestModule } from "@nestjs/common";
import { HealthController } from "./health/health.controller.js";
import { RequestContextMiddleware } from "./common/request-context.middleware.js";
import { MerchantsModule } from "./modules/merchants/merchants.module.js";
import { ExperiencesModule } from "./modules/experiences/experiences.module.js";
import { CampaignsModule } from "./modules/campaigns/campaigns.module.js";
import { CatalogModule } from "./modules/catalog/catalog.module.js";

@Module({
  imports: [MerchantsModule, ExperiencesModule, CampaignsModule, CatalogModule],
  controllers: [HealthController],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes("*");
  }
}
