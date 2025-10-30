"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const multer_1 = __importDefault(require("multer"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const prismaClient_1 = require("../prismaClient");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
/* -------------------------------------------------------------------------- */
/* ✅ Ensure uploads folder exists                                            */
/* -------------------------------------------------------------------------- */
const uploadDir = path_1.default.join(__dirname, "../../uploads");
if (!fs_1.default.existsSync(uploadDir))
    fs_1.default.mkdirSync(uploadDir, { recursive: true });
/* -------------------------------------------------------------------------- */
/* ✅ Multer configuration                                                    */
/* -------------------------------------------------------------------------- */
const storage = multer_1.default.diskStorage({
    destination: (_, __, cb) => cb(null, uploadDir),
    filename: (_, file, cb) => {
        const unique = Date.now() + "-" + file.originalname.replace(/\s+/g, "_");
        cb(null, unique);
    },
});
const upload = (0, multer_1.default)({ storage });
/* -------------------------------------------------------------------------- */
/* ✅ Helper to safely parse JSON from FormData                               */
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
        if (!user?.id) {
            return res.status(400).json({ message: "User not found in request" });
        }
        const entryData = parseBody(req);
        const { title, type, director, budget, location, durationMin, year, details, description } = entryData;
        if (!title || !type) {
            return res.status(400).json({ message: "Missing required fields: title, type" });
        }
        const posterPath = req.file ? `/uploads/${req.file.filename}` : null;
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
        if (!user?.id) {
            return res.status(400).json({ message: "User not found in request" });
        }
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
/* ✅ UPDATE ENTRY                                                            */
/* -------------------------------------------------------------------------- */
router.put("/:id", auth_1.requireAuth, upload.single("poster"), async (req, res) => {
    try {
        const entryData = parseBody(req);
        const { title, type, director, budget, location, durationMin, year, details, description } = entryData;
        const posterPath = req.file ? `/uploads/${req.file.filename}` : undefined;
        const updated = await prismaClient_1.prisma.entry.update({
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
    }
    catch (error) {
        console.error("❌ Update Entry Error:", error.message);
        res.status(500).json({ message: "Server error updating entry", error: error.message });
    }
});
/* -------------------------------------------------------------------------- */
/* ✅ DELETE ENTRY                                                            */
/* -------------------------------------------------------------------------- */
router.delete("/:id", auth_1.requireAuth, async (req, res) => {
    try {
        await prismaClient_1.prisma.entry.delete({
            where: { id: Number(req.params.id) },
        });
        res.json({ message: "Entry deleted successfully" });
    }
    catch (error) {
        console.error("❌ Delete Entry Error:", error.message);
        res.status(500).json({ message: "Server error deleting entry", error: error.message });
    }
});
exports.default = router;
