import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { loadConfig } from "@passasorte/config";
import { createLogger } from "@passasorte/observability";
import { AppModule } from "./app.module.js";
import { GlobalHttpExceptionFilter } from "./common/http-exception.filter.js";

async function bootstrap(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger({
    serviceName: config.serviceName,
    environment: config.env,
    level: config.logging.level,
  });

  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
    bufferLogs: true,
  });

  app.useGlobalFilters(new GlobalHttpExceptionFilter(logger));
  app.setGlobalPrefix("api/v1", { exclude: ["health"] });

  await app.listen(config.http.port, config.http.host);

  logger.info(
    { operation: "bootstrap", port: config.http.port, host: config.http.host },
    `PassaSorte API listening on http://${config.http.host}:${config.http.port}`,
  );
}

bootstrap().catch((error: unknown) => {
  console.error("Fatal error during bootstrap", error);
  process.exit(1);
});
