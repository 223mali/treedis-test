import pino from "pino";
import { AppConfig } from "./config";

export class Logger {
  private logger: pino.Logger;

  constructor(config: AppConfig) {
    this.logger = pino({
      level: config.logLevel,
      ...(!config.isProduction && {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:standard",
          },
        },
      }),
    });
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.logger.info(data, message);
  }

  error(message: string, data?: Record<string, unknown>): void {
    this.logger.error(data, message);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.logger.warn(data, message);
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.logger.debug(data, message);
  }
}
