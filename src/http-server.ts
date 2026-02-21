import * as http from "http";
import { Router } from "./router";
import { Logger } from "./logger";

export class HttpServer {
  private server: http.Server;
  private logger: Logger;
  private port: number;

  constructor(router: Router, logger: Logger, port: number) {
    this.logger = logger;
    this.port = port;
    this.server = http.createServer((req, res) => router.resolve(req, res));
  }

  public start(): void {
    this.server.listen(this.port, () => {
      this.logger.info(`Media Server running on http://localhost:${this.port}`);
    });
  }

  public stop(): void {
    this.server.close(() => {
      this.logger.info("Server stopped");
    });
  }
}
