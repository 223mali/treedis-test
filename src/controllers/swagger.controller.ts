import * as http from "http";
import * as fs from "fs";
import * as path from "path";
import { Logger } from "../logger";
import { Router } from "../router";

export class SwaggerController {
  private logger: Logger;
  private swaggerSpec: object;

  constructor(logger: Logger, router: Router) {
    this.logger = logger;
    this.swaggerSpec = this.loadSpec();
    this.registerRoutes(router);
  }

  private loadSpec(): object {
    try {
      const specPath = path.join(__dirname, "../swagger/swagger-output.json");
      const raw = fs.readFileSync(specPath, "utf-8");
      return JSON.parse(raw);
    } catch {
      this.logger.warn(
        'Swagger spec not found. Run "npm run swagger" to generate it.',
      );
      return {};
    }
  }

  private registerRoutes(router: Router): void {
    router.get("/api-docs", (_req, res, _params) =>
      this.serveSwaggerUI(_req, res),
    );
    router.get("/api-docs/swagger.json", (_req, res, _params) =>
      this.serveSpec(_req, res),
    );
  }

  private serveSpec(
    _req: http.IncomingMessage,
    res: http.ServerResponse,
  ): void {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(this.swaggerSpec));
  }

  private serveSwaggerUI(
    _req: http.IncomingMessage,
    res: http.ServerResponse,
  ): void {
    this.logger.info("Swagger UI requested");

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Media Service - API Docs</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      url: '/api-docs/swagger.json',
      dom_id: '#swagger-ui',
      presets: [
        SwaggerUIBundle.presets.apis,
        SwaggerUIBundle.SwaggerUIStandalonePreset
      ],
      layout: 'BaseLayout'
    });
  </script>
</body>
</html>`;

    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(html);
  }
}
