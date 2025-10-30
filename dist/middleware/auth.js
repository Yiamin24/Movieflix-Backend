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
/* -------------------------------------------------------------------------- */
/* ✅ Authentication Middleware                                               */
/* -------------------------------------------------------------------------- */
async function requireAuth(req, res, next) {
    try {
        const header = req.headers.authorization;
        if (!header) {
            return res.status(401).json({ message: "Missing Authorization header" });
        }
        // Extract token from "Bearer <token>"
        const token = header.startsWith("Bearer ") ? header.slice(7).trim() : header.trim();
        // Verify JWT
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || "");
        const userId = Number(decoded.userId);
        if (isNaN(userId)) {
            return res.status(400).json({ message: "Invalid token payload" });
        }
        // Fetch user from DB
        const user = await prismaClient_1.prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, name: true, email: true },
        });
        if (!user) {
            return res.status(401).json({ message: "User not found or invalid token" });
        }
        // Attach user to request
        req.user = user;
        next();
    }
    catch (err) {
        console.error("❌ Auth middleware error:", err.message);
        return res.status(401).json({ message: "Unauthorized: Invalid or expired token" });
    }
}
