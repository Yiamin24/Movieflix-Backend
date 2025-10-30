"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const swagger_1 = require("./swagger/swagger");
dotenv_1.default.config();
const auth_1 = __importDefault(require("./routes/auth"));
const entries_1 = __importDefault(require("./routes/entries"));
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: "10mb" }));
app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
        const duration = Date.now() - start;
        console.log(`🔹 [${new Date().toLocaleTimeString()}] ${req.method} ${req.originalUrl} | Status: ${res.statusCode} | ${duration}ms`);
    });
    next();
});
const uploadDir = process.env.UPLOAD_DIR || "uploads";
app.use("/uploads", express_1.default.static(path_1.default.join(process.cwd(), uploadDir)));
(0, swagger_1.setupSwagger)(app);
app.use("/api/auth", auth_1.default);
app.use("/api/entries", entries_1.default);
app.get("/health", (_, res) => {
    res.json({ status: "ok" });
});
app.use((err, req, res, next) => {
    console.error(`❌ [${new Date().toLocaleTimeString()}] Error:`, err.message);
    if (process.env.NODE_ENV !== "production")
        console.error(err.stack);
    res.status(500).json({ error: "Internal Server Error" });
});
const PORT = Number(process.env.PORT) || 4000;
app.listen(PORT, () => {
    console.log(`🚀 MovieFlix backend running at http://localhost:${PORT}`);
    console.log(`📘 Swagger docs available at http://localhost:${PORT}/api-docs`);
});
