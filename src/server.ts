import "reflect-metadata";
import "dotenv/config";
import { loadConfig } from "./config";
import { Logger } from "./logger";
import { Router } from "./router";
import { HttpServer } from "./http-server";
import { HealthController } from "./controllers/health.controller";
import { SwaggerController } from "./controllers/swagger.controller";
import { MediaController } from "./controllers/media.controller";
import { S3Service } from "./services/s3.service";
import { FileValidator } from "./services/file-validator.service";
import { MetadataStore } from "./services/metadata-store.service";

/**
 * Composition root — all dependencies are wired manually here.
 * No DI container is used; every dependency is explicit.
 */
function bootstrap(): void {
  const config = loadConfig();

  // -- Shared services --
  const logger = new Logger(config);
  const router = new Router(logger);
  const s3Service = new S3Service(logger, config);
  const fileValidator = new FileValidator(logger, config);
  const metadataStore = new MetadataStore(logger, config);

  // -- Controllers (self-register routes via constructor) --
  new HealthController(logger, router);
  new MediaController(
    logger,
    router,
    s3Service,
    fileValidator,
    metadataStore,
    config,
  );
  new SwaggerController(logger, router);

  // -- Start server --
  const server = new HttpServer(
    router,
    logger,
    config.port,
    config.requestTimeoutMs,
  );
  server.start();

  // ── Graceful shutdown ───────────────────────────────────────────────
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal} — shutting down…`);
    try {
      await server.stop();
      metadataStore.close();
    } catch (err) {
      logger.error(`Shutdown error: ${err}`);
    }
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  // ── Last-resort error handlers ──────────────────────────────────────
  process.on("uncaughtException", (err) => {
    logger.error(`Uncaught exception: ${err.stack || err.message}`);
    process.exit(1);
  });

  process.on("unhandledRejection", (reason) => {
    logger.error(`Unhandled rejection: ${reason}`);
  });
}

bootstrap();
