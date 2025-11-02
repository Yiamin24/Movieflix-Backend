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
        // 🔐 Ensure Authorization header exists
        if (!header)
            return res.status(401).json({ message: "Authorization header missing" });
        // 🧾 Extract Bearer token
        const token = header.startsWith("Bearer ")
            ? header.substring(7).trim()
            : header.trim();
        if (!token)
            return res.status(401).json({ message: "Token missing or invalid format" });
        // 🔑 Verify JWT
        const secret = process.env.JWT_SECRET;
        if (!secret) {
            console.error("❌ Missing JWT_SECRET in .env");
            return res
                .status(500)
                .json({ message: "Server misconfiguration (JWT secret missing)" });
        }
        const decoded = jsonwebtoken_1.default.verify(token, secret);
        // ✅ Support both id and userId keys
        const userId = Number(decoded.id ?? decoded.userId);
        if (!userId || isNaN(userId)) {
            console.error("❌ Invalid user ID in token payload:", decoded);
            return res.status(400).json({ message: "Invalid token payload" });
        }
        // 🧠 Fetch user from database
        const user = await prismaClient_1.prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, name: true, email: true, role: true, isVerified: true },
        });
        if (!user)
            return res
                .status(401)
                .json({ message: "User not found or no longer exists" });
        // 🚫 Block access for unverified users
        if (!user.isVerified)
            return res.status(403).json({ message: "Please verify your email first" });
        // ✅ Attach user to request object for downstream routes
        req.user = {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
        };
        next();
    }
    catch (err) {
        if (err.name === "TokenExpiredError") {
            return res.status(401).json({ message: "Session expired. Please log in again." });
        }
        if (err.name === "JsonWebTokenError") {
            return res.status(401).json({ message: "Invalid token. Please log in again." });
        }
        console.error("❌ Auth middleware error:", err);
        return res.status(401).json({ message: "Unauthorized access" });
    }
}
