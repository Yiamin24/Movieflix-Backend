import dotenv from "dotenv";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import path from "path";
import { setupSwagger } from "./swagger/swagger";


dotenv.config();

import authRoutes from "./routes/auth";
import entriesRoutes from "./routes/entries";

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(
      `🔹 [${new Date().toLocaleTimeString()}] ${req.method} ${req.originalUrl} | Status: ${res.statusCode} | ${duration}ms`
    );
  });
  next();
});

const uploadDir = process.env.UPLOAD_DIR || "uploads";
app.use("/uploads", express.static(path.join(process.cwd(), uploadDir)));

setupSwagger(app);

app.use("/api/auth", authRoutes);
app.use("/api/entries", entriesRoutes);

app.get("/health", (_: Request, res: Response) => {
  res.json({ status: "ok" });
});

app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error(`❌ [${new Date().toLocaleTimeString()}] Error:`, err.message);
  if (process.env.NODE_ENV !== "production") console.error(err.stack);
  res.status(500).json({ error: "Internal Server Error" });
});

const PORT = Number(process.env.PORT) || 4000;
app.listen(PORT, () => {
  console.log(`🚀 MovieFlix backend running at http://localhost:${PORT}`);
  console.log(`📘 Swagger docs available at http://localhost:${PORT}/api-docs`);
});
