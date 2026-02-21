import * as http from "http";
import { Router } from "./router";
import { Logger } from "./logger";

export class HttpServer {
  private server: http.Server;
  private logger: Logger;
  private port: number;

  constructor(
    router: Router,
    logger: Logger,
    port: number,
    requestTimeoutMs = 30_000,
  ) {
    this.logger = logger;
    this.port = port;

    this.server = http.createServer((req, res) => {
      // Per-request timeout — prevents hung connections from lingering
      res.setTimeout(requestTimeoutMs, () => {
        this.logger.warn(
          `Request timed out after ${requestTimeoutMs}ms: ${req.method} ${req.url}`,
        );
        if (!res.writableEnded) {
          res.writeHead(408, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Request Timeout" }));
        }
      });

      router.resolve(req, res);
    });
  }

  public start(): void {
    this.server.listen(this.port, () => {
      this.logger.info(`Media Server running on http://localhost:${this.port}`);
    });
  }

  /**
   * Gracefully stops the server — stops accepting new connections and
   * waits for in-flight requests to finish.
   */
  public stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.close((err) => {
        if (err) {
          this.logger.error(`Error stopping server: ${err.message}`);
          return reject(err);
        }
        this.logger.info("Server stopped gracefully");
        resolve();
      });
    });
  }
}
