import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import fastifyHelmet from "@fastify/helmet";
import fastifyRateLimit from "@fastify/rate-limit";
import fastifyCors from "@fastify/cors";
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

  // TASK-059 Security Hardening: security response headers (HSTS,
  // X-Content-Type-Options, etc.) - CSP disabled, this is a JSON API with
  // no HTML surface to protect with one.
  await app.register(fastifyHelmet, { contentSecurityPolicy: false });

  // TASK-060 Rate Limiting: one global bucket per client (keyed by the
  // authenticated user when present, else IP) - CLAUDE.md #42 treats this
  // as operational pacing, not a business rule, so it comes from config
  // (RATE_LIMIT_MAX/RATE_LIMIT_WINDOW_MS), never a hard-coded number.
  await app.register(fastifyRateLimit, {
    max: config.security.rateLimit.max,
    timeWindow: config.security.rateLimit.windowMs,
  });

  // TASK-059 Security Hardening: "deny by default" (CLAUDE.md #18) - no
  // origin is allowed to call this API from a browser until a deployment
  // explicitly lists it in CORS_ALLOWED_ORIGINS (apps/web is the only
  // known browser caller so far).
  await app.register(fastifyCors, {
    origin: config.security.corsAllowedOrigins,
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
