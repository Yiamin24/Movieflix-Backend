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
        // 🔐 Ensure Authorization header is present
        if (!header) {
            return res.status(401).json({ message: "Authorization header missing" });
        }
        // 🧾 Extract token from "Bearer <token>"
        const token = header.startsWith("Bearer ")
            ? header.slice(7).trim()
            : header.trim();
        if (!token) {
            return res.status(401).json({ message: "Token missing" });
        }
        // 🔑 Verify and decode JWT
        const secret = process.env.JWT_SECRET;
        if (!secret) {
            console.error("❌ JWT_SECRET not set in .env");
            return res.status(500).json({ message: "Server misconfiguration" });
        }
        const decoded = jsonwebtoken_1.default.verify(token, secret);
        // ✅ Support both 'id' and 'userId'
        const userId = Number(decoded.id ?? decoded.userId);
        if (!userId || isNaN(userId)) {
            console.error("❌ Invalid userId in token:", decoded);
            return res.status(400).json({ message: "Invalid token payload" });
        }
        // 🧠 Fetch user details from database
        const user = await prismaClient_1.prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, name: true, email: true },
        });
        if (!user) {
            return res.status(401).json({ message: "User not found or token invalid" });
        }
        // ✅ Attach user to request object for next handlers
        req.user = user;
        next();
    }
    catch (err) {
        if (err.name === "TokenExpiredError") {
            return res.status(401).json({ message: "Token expired. Please login again." });
        }
        if (err.name === "JsonWebTokenError") {
            return res.status(401).json({ message: "Invalid token signature" });
        }
        console.error("❌ Auth middleware error:", err);
        return res.status(401).json({ message: "Unauthorized: Invalid or expired token" });
    }
}
