import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();

console.log("✅ PrismaClient initialized successfully");
