import express, { Request, Response } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { prisma } from "../prismaClient";
import { requireAuth } from "../middleware/auth";
import { createEntrySchema, updateEntrySchema } from "../validation/entrySchemas";
import { sendAdminNotification } from "../utils/email";

dotenv.config();

const router = express.Router();
const UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads";

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req: Request, _file: any, cb: (err: Error | null, dest: string) => void) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (_req: Request, file: any, cb: (err: Error | null, filename: string) => void) => {
    const ext = path.extname(file.originalname || "");
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
});

router.post("/", requireAuth, upload.single("poster"), async (req: Request, res: Response) => {
  try {
    // narrow the request where we need user/file
    const authReq = req as Request & { user?: { id: number; email: string }; file?: any };

    const payload = (req.body && (req.body.data ? JSON.parse(req.body.data) : req.body)) || {};
    const parsed = createEntrySchema.parse(payload);
    const parsedAny = parsed as any;

    let posterPath: string | null = null;

    if (authReq.file) {
      posterPath = `/uploads/${authReq.file.filename}`;
    } else if (parsedAny?.poster?.startsWith?.("data:image")) {
      const base64Data = String(parsedAny.poster).split(";base64,").pop();
      if (base64Data) {
        const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
        const fullPath = path.join(UPLOAD_DIR, fileName);
        fs.writeFileSync(fullPath, Buffer.from(base64Data, "base64"));
        posterPath = `/uploads/${fileName}`;
      }
    } else if (typeof parsedAny?.poster === "string" && parsedAny.poster.startsWith("http")) {
      posterPath = parsedAny.poster;
    }

    const dataToCreate: any = {
      userId: authReq.user?.id ?? null,
      title: parsed.title,
      type: parsed.type,
      director: parsed.director ?? null,
      location: parsed.location ?? null,
      durationMin: parsed.durationMin ?? null,
      year: parsed.year ?? null,
      details: parsed.details ?? null,
      posterPath,
      budget: parsed.budget ? String(parsed.budget).replace(/[^\d.]/g, "") : null,
    };

    const entry = await prisma.entry.create({ data: dataToCreate });

    if (authReq.user?.email) {
      sendAdminNotification("New entry added", `User ${authReq.user.email} added "${entry.title}"`).catch(console.error);
    }

    res.status(201).json(entry);
  } catch (err: any) {
    console.error("❌ Error creating entry:", err);
    if (err?.issues) return res.status(400).json({ message: "Validation failed", issues: err.issues });
    res.status(400).json({ message: err?.message || "Invalid request" });
  }
});

router.put("/:id", requireAuth, upload.single("poster"), async (req: Request, res: Response) => {
  try {
    const authReq = req as Request & { user?: { id: number }; file?: any };

    const { id } = req.params;
    const payload = (req.body && (req.body.data ? JSON.parse(req.body.data) : req.body)) || {};
    const parsed = updateEntrySchema.parse(payload);
    const parsedAny = parsed as any;

    let posterPath: string | undefined;

    if (authReq.file) {
      posterPath = `/uploads/${authReq.file.filename}`;
    } else if (parsedAny?.poster?.startsWith?.("data:image")) {
      const base64Data = String(parsedAny.poster).split(";base64,").pop();
      if (base64Data) {
        const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
        const fullPath = path.join(UPLOAD_DIR, fileName);
        fs.writeFileSync(fullPath, Buffer.from(base64Data, "base64"));
        posterPath = `/uploads/${fileName}`;
      }
    } else if (typeof parsedAny?.poster === "string" && parsedAny.poster.startsWith("http")) {
      posterPath = parsedAny.poster;
    }

    const dataToUpdate: any = { ...parsedAny };
    if (posterPath) dataToUpdate.posterPath = posterPath;
    if (dataToUpdate.durationMin !== undefined) {
      dataToUpdate.durationMin = dataToUpdate.durationMin === null ? null : String(dataToUpdate.durationMin).trim();
    }
    if (dataToUpdate.year !== undefined && dataToUpdate.year !== null) {
      dataToUpdate.year = Number(dataToUpdate.year);
    }
    if (parsedAny.budget) {
      dataToUpdate.budget = String(parsedAny.budget).replace(/[^\d.]/g, "");
    }

    const updated = await prisma.entry.update({
      where: { id: Number(id) },
      data: dataToUpdate,
    });

    res.json({ message: "Entry updated successfully", updated });
  } catch (err: any) {
    console.error("❌ Error updating entry:", err);
    res.status(400).json({ message: err?.message || "Failed to update entry" });
  }
});

router.delete("/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.entry.delete({ where: { id: Number(id) } });
    res.json({ message: "Entry deleted successfully" });
  } catch (err: any) {
    console.error("❌ Error deleting entry:", err);
    res.status(400).json({ message: err?.message || "Failed to delete entry" });
  }
});

router.get("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const authReq = req as Request & { user?: { id: number } };
    const entries = await prisma.entry.findMany({
      where: { userId: authReq.user?.id ?? undefined },
      orderBy: { createdAt: "desc" },
    });
    res.json(entries);
  } catch (err: any) {
    console.error("❌ Error fetching entries:", err);
    res.status(500).json({ message: "Failed to fetch entries" });
  }
});

export default router;
