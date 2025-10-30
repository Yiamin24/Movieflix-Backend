"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const multer_1 = __importDefault(require("multer"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
const prismaClient_1 = require("../prismaClient");
const auth_1 = require("../middleware/auth");
const entrySchemas_1 = require("../validation/entrySchemas");
const email_1 = require("../utils/email");
dotenv_1.default.config();
const router = express_1.default.Router();
const UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads";
if (!fs_1.default.existsSync(UPLOAD_DIR)) {
    fs_1.default.mkdirSync(UPLOAD_DIR, { recursive: true });
}
const storage = multer_1.default.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, UPLOAD_DIR);
    },
    filename: (_req, file, cb) => {
        const ext = path_1.default.extname(file.originalname || "");
        cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
    },
});
const upload = (0, multer_1.default)({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
});
router.post("/", auth_1.requireAuth, upload.single("poster"), async (req, res) => {
    try {
        // narrow the request where we need user/file
        const authReq = req;
        const payload = (req.body && (req.body.data ? JSON.parse(req.body.data) : req.body)) || {};
        const parsed = entrySchemas_1.createEntrySchema.parse(payload);
        const parsedAny = parsed;
        let posterPath = null;
        if (authReq.file) {
            posterPath = `/uploads/${authReq.file.filename}`;
        }
        else if (parsedAny?.poster?.startsWith?.("data:image")) {
            const base64Data = String(parsedAny.poster).split(";base64,").pop();
            if (base64Data) {
                const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
                const fullPath = path_1.default.join(UPLOAD_DIR, fileName);
                fs_1.default.writeFileSync(fullPath, Buffer.from(base64Data, "base64"));
                posterPath = `/uploads/${fileName}`;
            }
        }
        else if (typeof parsedAny?.poster === "string" && parsedAny.poster.startsWith("http")) {
            posterPath = parsedAny.poster;
        }
        const dataToCreate = {
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
        const entry = await prismaClient_1.prisma.entry.create({ data: dataToCreate });
        if (authReq.user?.email) {
            (0, email_1.sendAdminNotification)("New entry added", `User ${authReq.user.email} added "${entry.title}"`).catch(console.error);
        }
        res.status(201).json(entry);
    }
    catch (err) {
        console.error("❌ Error creating entry:", err);
        if (err?.issues)
            return res.status(400).json({ message: "Validation failed", issues: err.issues });
        res.status(400).json({ message: err?.message || "Invalid request" });
    }
});
router.put("/:id", auth_1.requireAuth, upload.single("poster"), async (req, res) => {
    try {
        const authReq = req;
        const { id } = req.params;
        const payload = (req.body && (req.body.data ? JSON.parse(req.body.data) : req.body)) || {};
        const parsed = entrySchemas_1.updateEntrySchema.parse(payload);
        const parsedAny = parsed;
        let posterPath;
        if (authReq.file) {
            posterPath = `/uploads/${authReq.file.filename}`;
        }
        else if (parsedAny?.poster?.startsWith?.("data:image")) {
            const base64Data = String(parsedAny.poster).split(";base64,").pop();
            if (base64Data) {
                const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
                const fullPath = path_1.default.join(UPLOAD_DIR, fileName);
                fs_1.default.writeFileSync(fullPath, Buffer.from(base64Data, "base64"));
                posterPath = `/uploads/${fileName}`;
            }
        }
        else if (typeof parsedAny?.poster === "string" && parsedAny.poster.startsWith("http")) {
            posterPath = parsedAny.poster;
        }
        const dataToUpdate = { ...parsedAny };
        if (posterPath)
            dataToUpdate.posterPath = posterPath;
        if (dataToUpdate.durationMin !== undefined) {
            dataToUpdate.durationMin = dataToUpdate.durationMin === null ? null : String(dataToUpdate.durationMin).trim();
        }
        if (dataToUpdate.year !== undefined && dataToUpdate.year !== null) {
            dataToUpdate.year = Number(dataToUpdate.year);
        }
        if (parsedAny.budget) {
            dataToUpdate.budget = String(parsedAny.budget).replace(/[^\d.]/g, "");
        }
        const updated = await prismaClient_1.prisma.entry.update({
            where: { id: Number(id) },
            data: dataToUpdate,
        });
        res.json({ message: "Entry updated successfully", updated });
    }
    catch (err) {
        console.error("❌ Error updating entry:", err);
        res.status(400).json({ message: err?.message || "Failed to update entry" });
    }
});
router.delete("/:id", auth_1.requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        await prismaClient_1.prisma.entry.delete({ where: { id: Number(id) } });
        res.json({ message: "Entry deleted successfully" });
    }
    catch (err) {
        console.error("❌ Error deleting entry:", err);
        res.status(400).json({ message: err?.message || "Failed to delete entry" });
    }
});
router.get("/", auth_1.requireAuth, async (req, res) => {
    try {
        const authReq = req;
        const entries = await prismaClient_1.prisma.entry.findMany({
            where: { userId: authReq.user?.id ?? undefined },
            orderBy: { createdAt: "desc" },
        });
        res.json(entries);
    }
    catch (err) {
        console.error("❌ Error fetching entries:", err);
        res.status(500).json({ message: "Failed to fetch entries" });
    }
});
exports.default = router;
