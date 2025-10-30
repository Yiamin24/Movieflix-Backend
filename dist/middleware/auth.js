"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prismaClient_1 = require("../prismaClient");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
async function requireAuth(req, res, next) {
    const header = req.headers.authorization;
    if (!header) {
        return res.status(401).json({ message: "Missing Authorization header" });
    }
    const token = header.startsWith("Bearer ") ? header.slice(7) : header;
    try {
        const payload = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || "");
        const user = await prismaClient_1.prisma.user.findUnique({ where: { id: payload.id } });
        if (!user) {
            return res.status(401).json({ message: "Invalid token" });
        }
        req.user = user;
        next();
    }
    catch (err) {
        console.error("Auth error:", err);
        return res.status(401).json({ message: "Unauthorized" });
    }
}
