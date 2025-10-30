import express, { Request, Response } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { prisma } from "../prismaClient";
import { requireAuth } from "../middleware/auth";

const router = express.Router();

/* -------------------------------------------------------------------------- */
/* ✅ Ensure uploads folder exists                                            */
/* -------------------------------------------------------------------------- */
const uploadDir = path.join(__dirname, "../../uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

/* -------------------------------------------------------------------------- */
/* ✅ Multer configuration                                                    */
/* -------------------------------------------------------------------------- */
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadDir),
  filename: (_, file, cb) => {
    const unique = Date.now() + "-" + file.originalname.replace(/\s+/g, "_");
    cb(null, unique);
  },
});
const upload = multer({ storage });

/* -------------------------------------------------------------------------- */
/* ✅ Helper to safely parse JSON from FormData                               */
/* -------------------------------------------------------------------------- */
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

/* -------------------------------------------------------------------------- */
/* ✅ CREATE ENTRY                                                            */
/* -------------------------------------------------------------------------- */
router.post("/", requireAuth, upload.single("poster"), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.id) {
      return res.status(400).json({ message: "User not found in request" });
    }

    const entryData = parseBody(req);
    const { title, type, director, budget, location, durationMin, year, details, description } = entryData;

    if (!title || !type) {
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

    console.log("✅ New entry created:", newEntry.title);
    res.status(201).json(newEntry);
  } catch (error: any) {
    console.error("❌ Create Entry Error:", error.message);
    res.status(500).json({ message: "Server error creating entry", error: error.message });
  }
});

/* -------------------------------------------------------------------------- */
/* ✅ GET ENTRIES                                                            */
/* -------------------------------------------------------------------------- */
router.get("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.id) {
      return res.status(400).json({ message: "User not found in request" });
    }

    const entries = await prisma.entry.findMany({
      where: { userId: Number(user.id) },
      orderBy: { createdAt: "desc" },
    });

    res.json(entries);
  } catch (error: any) {
    console.error("❌ Fetch Entries Error:", error.message);
    res.status(500).json({ message: "Server error fetching entries", error: error.message });
  }
});

/* -------------------------------------------------------------------------- */
/* ✅ UPDATE ENTRY                                                            */
/* -------------------------------------------------------------------------- */
router.put("/:id", requireAuth, upload.single("poster"), async (req: Request, res: Response) => {
  try {
    const entryData = parseBody(req);
    const { title, type, director, budget, location, durationMin, year, details, description } = entryData;

    const posterPath = req.file ? `/uploads/${req.file.filename}` : undefined;

    const updated = await prisma.entry.update({
      where: { id: Number(req.params.id) },
      data: {
        title,
        type,
        director,
        budget,
        location,
        durationMin,
        year: year ? Number(year) : null,
        details: details || description || null,
        ...(posterPath ? { posterPath } : {}),
      },
    });

    res.json(updated);
  } catch (error: any) {
    console.error("❌ Update Entry Error:", error.message);
    res.status(500).json({ message: "Server error updating entry", error: error.message });
  }
});

/* -------------------------------------------------------------------------- */
/* ✅ DELETE ENTRY                                                            */
/* -------------------------------------------------------------------------- */
router.delete("/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    await prisma.entry.delete({
      where: { id: Number(req.params.id) },
    });
    res.json({ message: "Entry deleted successfully" });
  } catch (error: any) {
    console.error("❌ Delete Entry Error:", error.message);
    res.status(500).json({ message: "Server error deleting entry", error: error.message });
  }
});

export default router;
