import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../prismaClient";
import dotenv from "dotenv";

dotenv.config();

/* -------------------------------------------------------------------------- */
/* ✅ Extend Express Request Type to Include `user`                           */
/* -------------------------------------------------------------------------- */
declare module "express-serve-static-core" {
  interface Request {
    user?: {
      id: number;
      name: string | null;
      email: string;
    };
  }
}

/* -------------------------------------------------------------------------- */
/* ✅ Authentication Middleware                                               */
/* -------------------------------------------------------------------------- */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
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

    const decoded = jwt.verify(token, secret) as {
      id?: number | string;
      userId?: number | string;
      email: string;
    };

    // ✅ Support both 'id' and 'userId'
    const userId = Number(decoded.id ?? decoded.userId);
    if (!userId || isNaN(userId)) {
      console.error("❌ Invalid userId in token:", decoded);
      return res.status(400).json({ message: "Invalid token payload" });
    }

    // 🧠 Fetch user details from database
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true },
    });

    if (!user) {
      return res.status(401).json({ message: "User not found or token invalid" });
    }

    // ✅ Attach user to request object for next handlers
    req.user = user;
    next();
  } catch (err: any) {
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
