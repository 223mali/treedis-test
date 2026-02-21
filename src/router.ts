import * as http from "http";
import FindMyWay, { HTTPMethod } from "find-my-way";
import { Logger } from "./logger";

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

      this.logger.info(`${method} ${req.url}`);

      Promise.resolve(handler(req, res, routeParams)).catch((err) => {
        this.logger.error(`Unhandled error in route ${method} ${path}: ${err}`);
        if (!res.writableEnded) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Internal Server Error" }));
        }
      });
    });

    this.logger.info(`Registered route: ${method} ${path}`);
  }

  public resolve(req: http.IncomingMessage, res: http.ServerResponse): void {
    this.fmw.lookup(req, res);
  }
}
