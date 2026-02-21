import * as http from "http";
import FindMyWay, { HTTPMethod } from "find-my-way";
import { Logger } from "./logger";
import { AppError } from "./errors/app-error";

export type RouteHandler = (
  req: http.IncomingMessage,
  res: http.ServerResponse,
  params: Record<string, string>,
) => void | Promise<void>;

export class Router {
  private fmw: FindMyWay.Instance<FindMyWay.HTTPVersion.V1>;
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
    this.fmw = FindMyWay({
      defaultRoute: (_req, res) => {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Not Found" }));
      },
    });
  }

  public get(path: string, handler: RouteHandler): void {
    this.addRoute("GET", path, handler);
  }

  public post(path: string, handler: RouteHandler): void {
    this.addRoute("POST", path, handler);
  }

  public put(path: string, handler: RouteHandler): void {
    this.addRoute("PUT", path, handler);
  }

  public delete(path: string, handler: RouteHandler): void {
    this.addRoute("DELETE", path, handler);
  }

  private addRoute(
    method: HTTPMethod,
    path: string,
    handler: RouteHandler,
  ): void {
    this.fmw.on(method, path, (req, res, params) => {
      const routeParams = (params || {}) as Record<string, string>;
      console.log("🚀 ~ Router ~ addRoute ~ routeParams:", routeParams);

      this.logger.info(`${method} ${req.url} XXX`);

      Promise.resolve(handler(req, res, routeParams)).catch((err) => {
        this.handleRouteError(err, req, res, method, path);
      });
    });

    this.logger.info(`Registered route: ${method} ${path}`);
  }

  public resolve(req: http.IncomingMessage, res: http.ServerResponse): void {
    this.fmw.lookup(req, res);
  }

  // ─── Centralised error handler ──────────────────────────────────────

  private handleRouteError(
    err: unknown,
    req: http.IncomingMessage,
    res: http.ServerResponse,
    method: string,
    path: string,
  ): void {
    if (res.writableEnded) return;

    if (err instanceof AppError) {
      this.logger.error(
        `${method} ${req.url} → ${err.statusCode} ${err.message}`,
      );

      const body: Record<string, unknown> = { error: err.message };
      if (err.details) body.details = err.details;

      res.writeHead(err.statusCode, { "Content-Type": "application/json" });
      res.end(JSON.stringify(body));
      return;
    }

    // Unexpected / unknown error — log full stack and return 500
    this.logger.error(
      `Unhandled error in ${method} ${path}: ${
        err instanceof Error ? err.stack || err.message : err
      }`,
    );
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Internal Server Error" }));
  }
}
