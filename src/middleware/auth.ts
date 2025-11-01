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
    if (!header) {
      return res.status(401).json({ message: "Missing Authorization header" });
    }

    // Extract token from "Bearer <token>"
    const token = header.startsWith("Bearer ") ? header.slice(7).trim() : header.trim();

    // Verify JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "") as {
      id?: number | string;
      userId?: number | string;
      email: string;
    };

    // ✅ Support both 'id' and 'userId'
    const userId = Number(decoded.id || decoded.userId);

    if (!userId || isNaN(userId)) {
      console.error("❌ [Auth] Invalid userId in token:", decoded);
      return res.status(400).json({ message: "Invalid token payload" });
    }

    // Fetch user from DB
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true },
    });

    if (!user) {
      return res.status(401).json({ message: "User not found or invalid token" });
    }

    // Attach user to request
    req.user = user;
    next();
  } catch (err: any) {
    console.error("❌ Auth middleware error:", err.message);
    return res.status(401).json({ message: "Unauthorized: Invalid or expired token" });
  }
}
