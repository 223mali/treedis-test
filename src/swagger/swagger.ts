// eslint-disable-next-line @typescript-eslint/no-var-requires
const swaggerAutogen = require("swagger-autogen")({ openapi: "3.0.0" });

const doc = {
  info: {
    title: "Media Management Service",
    description:
      "A custom Node.js media management service with AWS S3 integration.",
    version: "1.0.0",
  },
  host: "localhost:3000",
  schemes: ["http"],
  tags: [
    { name: "Health", description: "Health check endpoints" },
    { name: "Media", description: "Media management endpoints" },
  ],
};

const outputFile = "./src/swagger/swagger-output.json";
const endpointFiles = [
  "./src/controllers/health.controller.ts",
  "./src/controllers/media.controller.ts",
];

swaggerAutogen(outputFile, endpointFiles, doc).then(() => {
  console.log("Swagger documentation generated successfully");
});
