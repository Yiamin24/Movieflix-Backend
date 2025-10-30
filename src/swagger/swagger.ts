import swaggerJsdoc, { Options } from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import { Express } from "express";

const options: Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "🎬 MovieFlix API",
      version: "1.0.0",
      description: `
        Comprehensive API documentation for the MovieFlix backend.
        <br><br>
        Use this interface to explore and test all available endpoints for authentication, entries, and more.
      `,
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
    servers: [
      {
        url: "http://localhost:4000",
        description: "Local Development Server",
      },
    ],
    tags: [
      {
        name: "Auth",
        description: "User authentication and account management endpoints",
      },
      {
        name: "Entries",
        description: "Movie & TV show management endpoints",
      },
      {
        name: "Users",
        description: "User-related operations (profile, preferences, etc.)",
      },
    ],
  },
  apis: ["./src/routes/*.ts", "./src/routes/*.js"],
};

export function setupSwagger(app: Express): void {
  const specs = swaggerJsdoc(options);
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(specs));
}
