import express, { Request, Response } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { prisma } from "../prismaClient";
import { requireAuth } from "../middleware/auth";

const router = express.Router();

const uploadDir = path.join(__dirname, "../../uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadDir),
  filename: (_, file, cb) => {
    const unique = Date.now() + "-" + file.originalname.replace(/\s+/g, "_");
    cb(null, unique);
  },
});
const upload = multer({ storage });

const parseBody = (req: Request) => {
  if (req.body?.data) {
    try {
      return JSON.parse(req.body.data);
    } catch (err) {
      console.warn("⚠️ Failed to parse JSON body:", err);
      return {};
    }
  }
  return req.body;
};

/* ------------------------------- CREATE ENTRY ----------------------------- */
router.post("/", requireAuth, upload.single("poster"), async (req: Request, res: Response) => {
  console.log("🟢 [API] POST /entries triggered");
  console.log("📦 Raw req.body:", req.body);
  console.log("📸 Uploaded file:", req.file);
  console.log("👤 Authenticated user:", (req as any).user);

  try {
    const user = (req as any).user;
    if (!user?.id) {
      console.error("❌ User missing from request");
      return res.status(400).json({ message: "User not found in request" });
    }

    const entryData = parseBody(req);
    console.log("📥 Parsed entryData:", entryData);

    const { title, type, director, budget, location, durationMin, year, details, description } = entryData;

    if (!title || !type) {
      console.error("❌ Missing required fields", { title, type });
      return res.status(400).json({ message: "Missing required fields: title, type" });
    }

    const posterPath = req.file ? `/uploads/${req.file.filename}` : null;

    const newEntry = await prisma.entry.create({
      data: {
        title,
        type,
        director,
        budget,
        location,
        durationMin,
        year: year ? Number(year) : null,
        details: details || description || null,
        posterPath,
        userId: Number(user.id),
      },
    });

    console.log("✅ [DB] New entry created:", newEntry);
    res.status(201).json(newEntry);
  } catch (error: any) {
    console.error("❌ [API] Create Entry Error:", error.message);
    res.status(500).json({ message: "Server error creating entry", error: error.message });
  }
});

/* ------------------------------- GET ENTRIES ------------------------------ */
router.get("/", requireAuth, async (req: Request, res: Response) => {
  console.log("🟢 [API] GET /entries triggered");
  console.log("👤 Authenticated user:", (req as any).user);
  try {
    const user = (req as any).user;
    if (!user?.id) {
      console.error("❌ User not found in request");
      return res.status(400).json({ message: "User not found in request" });
    }

    const entries = await prisma.entry.findMany({
      where: { userId: Number(user.id) },
      orderBy: { createdAt: "desc" },
    });

    console.log("✅ [DB] Entries fetched:", entries.length);
    res.json(entries);
  } catch (error: any) {
    console.error("❌ [API] Fetch Entries Error:", error.message);
    res.status(500).json({ message: "Server error fetching entries", error: error.message });
  }
});
