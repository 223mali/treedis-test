import * as http from "http";
import { Logger } from "../logger";
import { Router } from "../router";

export class HealthController {
  private logger: Logger;

  constructor(logger: Logger, router: Router) {
    this.logger = logger;
    this.registerRoutes(router);
  }

  private registerRoutes(router: Router): void {
    router.get("/health", (req, res, _params) => this.getHealth(req, res));
  }

  private getHealth(
    _req: http.IncomingMessage,
    res: http.ServerResponse,
  ): void {
    // #swagger.tags = ['Health']
    // #swagger.summary = 'Health check'
    // #swagger.description = 'Returns the current health status of the service'
    /* #swagger.responses[200] = {
      description: 'Service is healthy',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              status: { type: 'string', example: 'healthy' },
              timestamp: { type: 'string', format: 'date-time', example: '2026-02-21T08:00:00.000Z' }
            }
          }
        }
      }
    } */
    this.logger.info("Health check requested");

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: "healthy",
        timestamp: new Date().toISOString(),
      }),
    );
  }
}
