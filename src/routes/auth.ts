import express, { Request, Response } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt, { Secret, SignOptions } from "jsonwebtoken";
import dotenv from "dotenv";
import { prisma } from "../prismaClient";
import {
  sendVerificationEmail,
  sendWelcomeEmail,
  sendAdminNotification,
  sendPasswordResetEmail,
} from "../utils/email";
import { signupSchema, loginSchema } from "../validation/authSchemas";

dotenv.config();
const router = express.Router();

/* -------------------------------------------------------------------------- */
/* Helper: Generate JWT Token                                                 */
/* -------------------------------------------------------------------------- */
const generateToken = (user: { id: number; email: string }) => {
  const jwtSecret: Secret = process.env.JWT_SECRET as Secret;
  const options: SignOptions = { expiresIn: "1h" };
  return jwt.sign({ userId: String(user.id), email: user.email }, jwtSecret, options);
};

/* -------------------------------------------------------------------------- */
/* SIGNUP ROUTE                                                               */
/* -------------------------------------------------------------------------- */
router.post("/signup", async (req: Request, res: Response) => {
  try {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid input" });
    }

    const { name, email, password } = parsed.data;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) return res.status(400).json({ message: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationToken = crypto.randomBytes(32).toString("hex");

    await prisma.user.create({
      data: { name, email, passwordHash: hashedPassword, verificationToken, isVerified: false },
    });

    await sendVerificationEmail(email, verificationToken);
    res.status(201).json({ message: "Signup successful! Please check your email to verify your account." });
  } catch (err) {
    console.error("❌ Signup error:", err);
    res.status(500).json({ message: "Server error during signup" });
  }
});

/* -------------------------------------------------------------------------- */
/* EMAIL VERIFICATION ROUTE                                                   */
/* -------------------------------------------------------------------------- */
router.get("/verify/:token", async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const user = await prisma.user.findFirst({ where: { verificationToken: token } });
    if (!user) return res.status(400).send("Invalid or expired verification link.");

    await prisma.user.update({
      where: { id: user.id },
      data: { isVerified: true, verificationToken: null },
    });

    await sendWelcomeEmail(user.email);
    await sendAdminNotification(user.name ?? "User", user.email ?? "");

    res.send(`<h2 style="font-family:sans-serif;">✅ Email verified successfully! You can now log in.</h2>`);
  } catch (err) {
    console.error("❌ Verification error:", err);
    res.status(500).send("Server error during email verification.");
  }
});

/* -------------------------------------------------------------------------- */
/* LOGIN ROUTE                                                                */
/* -------------------------------------------------------------------------- */
router.post("/login", async (req: Request, res: Response) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid input" });
    }

    const { email, password } = parsed.data;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(400).json({ message: "Invalid email or password" });

    if (!user.isVerified) return res.status(400).json({ message: "Please verify your email first" });

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) return res.status(400).json({ message: "Invalid email or password" });

    const token = generateToken(user);
    res.status(200).json({ message: "✅ Login successful", token, user: { id: user.id, name: user.name, email: user.email } });
  } catch (err) {
    console.error("❌ Login error:", err);
    res.status(500).json({ message: "Server error during login" });
  }
});

/* -------------------------------------------------------------------------- */
/* FORGOT PASSWORD                                                            */
/* -------------------------------------------------------------------------- */
router.post("/forgot-password", async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required" });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ message: "No user found with this email" });

    const resetToken = crypto.randomBytes(32).toString("hex");
    const tokenExpiry = new Date(Date.now() + 3600000); // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken, resetTokenExpiry: tokenExpiry },
    });

    await sendPasswordResetEmail(email, resetToken);
    res.status(200).json({ message: "Password reset link sent to your email." });
  } catch (err) {
    console.error("❌ Forgot password error:", err);
    res.status(500).json({ message: "Error sending password reset email" });
  }
});

/* -------------------------------------------------------------------------- */
/* RESET PASSWORD                                                             */
/* -------------------------------------------------------------------------- */
router.post("/reset-password/:token", async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const { newPassword } = req.body;
    if (!newPassword) return res.status(400).json({ message: "New password is required" });

    const user = await prisma.user.findFirst({
      where: { resetToken: token, resetTokenExpiry: { gt: new Date() } },
    });
    if (!user) return res.status(400).json({ message: "Invalid or expired reset token" });

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: hashedPassword, resetToken: null, resetTokenExpiry: null },
    });

    res.status(200).json({ message: "✅ Password reset successful! You can now log in." });
  } catch (err) {
    console.error("❌ Reset password error:", err);
    res.status(500).json({ message: "Error resetting password" });
  }
});

/* -------------------------------------------------------------------------- */
/* PROTECTED ROUTE                                                            */
/* -------------------------------------------------------------------------- */
router.get("/me", async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ message: "No token provided" });

    const token = authHeader.split(" ")[1];
    const jwtSecret: Secret = process.env.JWT_SECRET as Secret;
    const decoded = jwt.verify(token, jwtSecret) as { userId: string };
    const userId = Number(decoded.userId);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true },
    });

    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    console.error("❌ Protected route error:", err);
    res.status(401).json({ message: "Invalid or expired token" });
  }
});

export default router;
