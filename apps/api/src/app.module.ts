import { MiddlewareConsumer, Module, type NestModule } from "@nestjs/common";
import { HealthController } from "./health/health.controller.js";
import { RequestContextMiddleware } from "./common/request-context.middleware.js";

@Module({
  controllers: [HealthController],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes("*");
  }
}
