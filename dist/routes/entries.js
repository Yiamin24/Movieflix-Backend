"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const multer_1 = __importDefault(require("multer"));
const cloudinary_1 = require("cloudinary");
const multer_storage_cloudinary_1 = require("multer-storage-cloudinary");
const prismaClient_1 = require("../prismaClient");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
/* -------------------------------------------------------------------------- */
/* ✅ Cloudinary Configuration (uses CLOUDINARY_URL from .env automatically)  */
/* -------------------------------------------------------------------------- */
cloudinary_1.v2.config({ secure: true });
/* -------------------------------------------------------------------------- */
/* ✅ Multer Storage using Cloudinary                                         */
/* -------------------------------------------------------------------------- */
const storage = new multer_storage_cloudinary_1.CloudinaryStorage({
    cloudinary: cloudinary_1.v2,
    params: async (_req, _file) => ({
        folder: "movieflix_uploads",
        allowed_formats: ["jpg", "jpeg", "png", "webp"],
        transformation: [{ quality: "auto", fetch_format: "auto" }],
    }),
});
const upload = (0, multer_1.default)({ storage });
/* -------------------------------------------------------------------------- */
/* ✅ Safely parse JSON from FormData                                         */
/* -------------------------------------------------------------------------- */
const parseBody = (req) => {
    if (req.body?.data) {
        try {
            return JSON.parse(req.body.data);
        }
        catch (err) {
            console.warn("⚠️ Failed to parse JSON body:", err);
            return {};
        }
    }
    return req.body;
};
/* -------------------------------------------------------------------------- */
/* ✅ CREATE ENTRY                                                            */
/* -------------------------------------------------------------------------- */
router.post("/", auth_1.requireAuth, upload.single("poster"), async (req, res) => {
    try {
        const user = req.user;
        if (!user?.id)
            return res.status(400).json({ message: "User not found in request" });
        const entryData = parseBody(req);
        const { title, type, director, budget, location, durationMin, year, details, description } = entryData;
        if (!title || !type)
            return res.status(400).json({ message: "Missing required fields: title, type" });
        const file = req.file;
        const posterPath = file?.path || null;
        const cloudinaryId = file?.filename || null;
        const newEntry = await prismaClient_1.prisma.entry.create({
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
    }
    catch (error) {
        console.error("❌ Create Entry Error:", error.message);
        res.status(500).json({ message: "Server error creating entry", error: error.message });
    }
});
/* -------------------------------------------------------------------------- */
/* ✅ GET ENTRIES                                                            */
/* -------------------------------------------------------------------------- */
router.get("/", auth_1.requireAuth, async (req, res) => {
    try {
        const user = req.user;
        if (!user?.id)
            return res.status(400).json({ message: "User not found in request" });
        const entries = await prismaClient_1.prisma.entry.findMany({
            where: { userId: Number(user.id) },
            orderBy: { createdAt: "desc" },
        });
        res.json(entries);
    }
    catch (error) {
        console.error("❌ Fetch Entries Error:", error.message);
        res.status(500).json({ message: "Server error fetching entries", error: error.message });
    }
});
/* -------------------------------------------------------------------------- */
/* ✅ UPDATE ENTRY (Deletes old Cloudinary image if replaced)                 */
/* -------------------------------------------------------------------------- */
router.put("/:id", auth_1.requireAuth, upload.single("poster"), async (req, res) => {
    try {
        const entryId = Number(req.params.id);
        const entryData = parseBody(req);
        const { title, type, director, budget, location, durationMin, year, details, description } = entryData;
        const existing = await prismaClient_1.prisma.entry.findUnique({ where: { id: entryId } });
        if (!existing)
            return res.status(404).json({ message: "Entry not found" });
        const file = req.file;
        const posterPath = file?.path;
        const cloudinaryId = file?.filename;
        // Delete old Cloudinary image if new one uploaded
        if (posterPath && existing.cloudinaryId) {
            await cloudinary_1.v2.uploader.destroy(existing.cloudinaryId);
            console.log("🗑️ Old image deleted:", existing.cloudinaryId);
        }
        const updated = await prismaClient_1.prisma.entry.update({
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
    }
    catch (error) {
        console.error("❌ Update Entry Error:", error.message);
        res.status(500).json({ message: "Server error updating entry", error: error.message });
    }
});
/* -------------------------------------------------------------------------- */
/* ✅ DELETE ENTRY (Deletes image from Cloudinary too)                        */
/* -------------------------------------------------------------------------- */
router.delete("/:id", auth_1.requireAuth, async (req, res) => {
    try {
        const entryId = Number(req.params.id);
        const existing = await prismaClient_1.prisma.entry.findUnique({ where: { id: entryId } });
        if (!existing)
            return res.status(404).json({ message: "Entry not found" });
        if (existing.cloudinaryId) {
            await cloudinary_1.v2.uploader.destroy(existing.cloudinaryId);
            console.log("🗑️ Deleted Cloudinary image:", existing.cloudinaryId);
        }
        await prismaClient_1.prisma.entry.delete({ where: { id: entryId } });
        res.json({ message: "Entry and associated image deleted successfully" });
    }
    catch (error) {
        console.error("❌ Delete Entry Error:", error.message);
        res.status(500).json({ message: "Server error deleting entry", error: error.message });
    }
});
exports.default = router;
