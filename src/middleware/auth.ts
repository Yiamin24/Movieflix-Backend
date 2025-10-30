import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../prismaClient";
import dotenv from "dotenv";

dotenv.config();

declare module "express-serve-static-core" {
  interface Request {
    user?: {
      id: number;
      name: string | null;
      email: string;
    };
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    console.log("🔍 [Auth] Authorization Header:", header);

    if (!header) {
      console.warn("⚠️ Missing Authorization header");
      return res.status(401).json({ message: "Missing Authorization header" });
    }

    const token = header.startsWith("Bearer ") ? header.slice(7).trim() : header.trim();
    console.log("🔍 [Auth] Extracted Token:", token);

    const decoded = jwt.verify(token, process.env.JWT_SECRET || "") as {
      userId: string;
      email: string;
    };

    console.log("🔍 [Auth] Decoded Token Payload:", decoded);

    const userId = Number(decoded.userId);
    if (isNaN(userId)) {
      console.error("❌ [Auth] Invalid userId in token:", decoded.userId);
      return res.status(400).json({ message: "Invalid token payload" });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true },
    });

    if (!user) {
      console.warn("⚠️ [Auth] User not found for ID:", userId);
      return res.status(401).json({ message: "User not found or invalid token" });
    }

    console.log("✅ [Auth] Authenticated user:", user);
    req.user = user;
    next();
  } catch (err: any) {
    console.error("❌ [Auth Middleware Error]:", err.message);
    return res.status(401).json({ message: "Unauthorized: Invalid or expired token" });
  }
}
