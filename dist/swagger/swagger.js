"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupSwagger = setupSwagger;
const swagger_jsdoc_1 = __importDefault(require("swagger-jsdoc"));
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const options = {
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
function setupSwagger(app) {
    const specs = (0, swagger_jsdoc_1.default)(options);
    app.use("/api-docs", swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(specs));
}
