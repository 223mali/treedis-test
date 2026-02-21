import * as http from "http";
import { URL } from "url";
import { Logger } from "./logger";

type RouteHandler = (
  req: http.IncomingMessage,
  res: http.ServerResponse,
) => void | Promise<void>;

interface Route {
  method: string;
  path: string;
  handler: RouteHandler;
}

export class Router {
  private routes: Route[] = [];
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
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

  private addRoute(method: string, path: string, handler: RouteHandler): void {
    this.routes.push({ method, path, handler });
    this.logger.info(`Registered route: ${method} ${path}`);
  }

  public resolve(req: http.IncomingMessage, res: http.ServerResponse): void {
    const url = new URL(req.url || "", `http://${req.headers.host}`);
    const pathname = url.pathname;
    const method = req.method || "GET";

    this.logger.info(`${method} ${pathname}`);

    const route = this.routes.find(
      (r) => r.method === method && r.path === pathname,
    );

    if (route) {
      Promise.resolve(route.handler(req, res)).catch((err) => {
        this.logger.error(
          `Unhandled error in route ${method} ${pathname}: ${err}`,
        );
        if (!res.writableEnded) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Internal Server Error" }));
        }
      });
    } else {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not Found" }));
    }
  }
}
