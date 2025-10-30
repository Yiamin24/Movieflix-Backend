import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../prismaClient";
import dotenv from "dotenv";
dotenv.config();

declare module "express-serve-static-core" {
  interface Request {
    user?: any;
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;

  if (!header) {
    return res.status(401).json({ message: "Missing Authorization header" });
  }

  const token = header.startsWith("Bearer ") ? header.slice(7) : header;

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || "") as { id: number };

    const user = await prisma.user.findUnique({ where: { id: payload.id } });

    if (!user) {
      return res.status(401).json({ message: "Invalid token" });
    }

    req.user = user;

    next();
  } catch (err) {
    console.error("Auth error:", err);
    return res.status(401).json({ message: "Unauthorized" });
  }
}
