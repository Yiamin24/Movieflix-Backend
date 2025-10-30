import express, { Request, Response } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { prisma } from "../prismaClient";
import { requireAuth } from "../middleware/auth";

const router = express.Router();

// ✅ Ensure uploads folder exists
const uploadDir = path.join(__dirname, "../../uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// ✅ Multer config
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadDir),
  filename: (_, file, cb) => {
    const unique = Date.now() + "-" + file.originalname.replace(/\s+/g, "_");
    cb(null, unique);
  },
});
const upload = multer({ storage });

// ✅ CREATE ENTRY
router.post("/", requireAuth, upload.single("poster"), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.id) {
      console.log("❌ Missing user in request");
      return res.status(400).json({ message: "User not found in request" });
    }

    const { title, description = "", type, releaseDate } = req.body;

    if (!title || !type) {
      return res.status(400).json({ message: "Missing required fields: title, type" });
    }

    const posterPath = req.file ? `/uploads/${req.file.filename}` : null;

    const newEntry = await prisma.mediaEntry.create({
      data: {
        title,
        description,
        type,
        releaseDate: releaseDate ? new Date(releaseDate) : null,
        poster: posterPath,
        userId: user.id,
      },
    });

    console.log("✅ New entry created:", newEntry.title);
    res.status(201).json(newEntry);
  } catch (error: any) {
    console.error("❌ Create Entry Error:", error.message);
    res.status(500).json({ message: "Server error creating entry", error: error.message });
  }
});

// ✅ GET ENTRIES
router.get("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.id) {
      return res.status(400).json({ message: "User not found in request" });
    }

    const entries = await prisma.mediaEntry.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });

    res.json(entries);
  } catch (error: any) {
    console.error("❌ Fetch Entries Error:", error.message);
    res.status(500).json({ message: "Server error fetching entries", error: error.message });
  }
});

// ✅ UPDATE ENTRY
router.put("/:id", requireAuth, upload.single("poster"), async (req: Request, res: Response) => {
  try {
    const { title, description, type, releaseDate } = req.body;
    const posterPath = req.file ? `/uploads/${req.file.filename}` : undefined;

    const updated = await prisma.mediaEntry.update({
      where: { id: req.params.id },
      data: {
        title,
        description,
        type,
        releaseDate: releaseDate ? new Date(releaseDate) : null,
        ...(posterPath ? { poster: posterPath } : {}),
      },
    });

    res.json(updated);
  } catch (error: any) {
    console.error("❌ Update Entry Error:", error.message);
    res.status(500).json({ message: "Server error updating entry", error: error.message });
  }
});

// ✅ DELETE ENTRY
router.delete("/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    await prisma.mediaEntry.delete({ where: { id: req.params.id } });
    res.json({ message: "Entry deleted successfully" });
  } catch (error: any) {
    console.error("❌ Delete Entry Error:", error.message);
    res.status(500).json({ message: "Server error deleting entry", error: error.message });
  }
});

export default router;
