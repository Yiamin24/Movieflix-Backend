import express, { Request, Response } from "express";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import { prisma } from "../prismaClient";
import { requireAuth } from "../middleware/auth";

const router = express.Router();

/* -------------------------------------------------------------------------- */
/* ✅ Cloudinary Configuration (uses CLOUDINARY_URL from .env automatically)  */
/* -------------------------------------------------------------------------- */
cloudinary.config({ secure: true });

/* -------------------------------------------------------------------------- */
/* ✅ Multer Storage using Cloudinary                                         */
/* -------------------------------------------------------------------------- */
const storage = new CloudinaryStorage({
  cloudinary,
  params: async (_req, _file) => ({
    folder: "movieflix_uploads",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [{ quality: "auto", fetch_format: "auto" }],
  }),
});
const upload = multer({ storage });

/* -------------------------------------------------------------------------- */
/* ✅ Safely parse JSON from FormData                                         */
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
    if (!user?.id) return res.status(400).json({ message: "User not found in request" });

    const entryData = parseBody(req);
    const { title, type, director, budget, location, durationMin, year, details, description } = entryData;

    if (!title || !type) return res.status(400).json({ message: "Missing required fields: title, type" });

    const file = req.file as any;
    const posterPath = file?.path || null;
    const cloudinaryId = file?.filename || null;

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
        cloudinaryId,
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
    if (!user?.id) return res.status(400).json({ message: "User not found in request" });

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
/* ✅ UPDATE ENTRY (Deletes old Cloudinary image if replaced)                 */
/* -------------------------------------------------------------------------- */
router.put("/:id", requireAuth, upload.single("poster"), async (req: Request, res: Response) => {
  try {
    const entryId = Number(req.params.id);
    const entryData = parseBody(req);
    const { title, type, director, budget, location, durationMin, year, details, description } = entryData;

    const existing = await prisma.entry.findUnique({ where: { id: entryId } });
    if (!existing) return res.status(404).json({ message: "Entry not found" });

    const file = req.file as any;
    const posterPath = file?.path;
    const cloudinaryId = file?.filename;

    // Delete old Cloudinary image if new one uploaded
    if (posterPath && existing.cloudinaryId) {
      await cloudinary.uploader.destroy(existing.cloudinaryId);
      console.log("🗑️ Old image deleted:", existing.cloudinaryId);
    }

    const updated = await prisma.entry.update({
      where: { id: entryId },
      data: {
        title,
        type,
        director,
        budget,
        location,
        durationMin,
        year: year ? Number(year) : null,
        details: details || description || null,
        ...(posterPath ? { posterPath, cloudinaryId } : {}),
      },
    });

    res.json(updated);
  } catch (error: any) {
    console.error("❌ Update Entry Error:", error.message);
    res.status(500).json({ message: "Server error updating entry", error: error.message });
  }
});

/* -------------------------------------------------------------------------- */
/* ✅ DELETE ENTRY (Deletes image from Cloudinary too)                        */
/* -------------------------------------------------------------------------- */
router.delete("/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const entryId = Number(req.params.id);
    const existing = await prisma.entry.findUnique({ where: { id: entryId } });

    if (!existing) return res.status(404).json({ message: "Entry not found" });

    if (existing.cloudinaryId) {
      await cloudinary.uploader.destroy(existing.cloudinaryId);
      console.log("🗑️ Deleted Cloudinary image:", existing.cloudinaryId);
    }

    await prisma.entry.delete({ where: { id: entryId } });
    res.json({ message: "Entry and associated image deleted successfully" });
  } catch (error: any) {
    console.error("❌ Delete Entry Error:", error.message);
    res.status(500).json({ message: "Server error deleting entry", error: error.message });
  }
});

export default router;
