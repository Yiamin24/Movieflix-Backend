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
import { z } from "zod";

dotenv.config();
const router = express.Router();

/* -------------------------------------------------------------------------- */
/* ✅ Additional Validation Schemas                                           */
/* -------------------------------------------------------------------------- */
const forgotPasswordSchema = z.object({
  email: z.string().email(),
});
const verifyOtpSchema = z.object({
  email: z.string().email(),
  otp: z.string().length(6),
});
const resetPasswordSchema = z.object({
  email: z.string().email(),
  otp: z.string().length(6),
  newPassword: z.string().min(6),
  confirmPassword: z.string().min(6),
});

/* -------------------------------------------------------------------------- */
/* ✅ Helper: Generate JWT Token                                              */
/* -------------------------------------------------------------------------- */
const generateToken = (user: { id: number; email: string }) => {
  const jwtSecret: Secret = process.env.JWT_SECRET as Secret;
  const options: SignOptions = { expiresIn: "7d" };
  return jwt.sign({ id: user.id, email: user.email }, jwtSecret, options);
};

/* -------------------------------------------------------------------------- */
/* ✅ SIGNUP ROUTE (Email normalized)                                         */
/* -------------------------------------------------------------------------- */
router.post("/signup", async (req: Request, res: Response) => {
  try {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success)
      return res
        .status(400)
        .json({ message: parsed.error.errors[0]?.message || "Invalid input" });

    const name = parsed.data.name?.trim();
    const email = parsed.data.email.toLowerCase().trim();
    const password = parsed.data.password.trim();

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser)
      return res.status(400).json({ message: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationToken = crypto.randomBytes(32).toString("hex");

    await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: hashedPassword,
        verificationToken,
        isVerified: false,
      },
    });

    await sendVerificationEmail(email, verificationToken);

    // ✅ Added formClear flag for frontend to reset input fields
    res.status(201).json({
      message:
        "Signup successful! Please check your email to verify your account.",
      formClear: true,
    });
  } catch (err) {
    console.error("❌ Signup error:", err);
    res.status(500).json({ message: "Server error during signup" });
  }
});

/* -------------------------------------------------------------------------- */
/* ✅ EMAIL VERIFICATION                                                      */
/* -------------------------------------------------------------------------- */
router.get("/verify/:token", async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const user = await prisma.user.findFirst({
      where: { verificationToken: token },
    });
    if (!user)
      return res.status(400).send("Invalid or expired verification link.");

    await prisma.user.update({
      where: { id: user.id },
      data: { isVerified: true, verificationToken: null },
    });

    await sendWelcomeEmail(user.email);
    await sendAdminNotification(user.name ?? "User", user.email ?? "");

    res.send(
      `<h2 style="font-family:sans-serif;">✅ Email verified successfully! You can now log in.</h2>`
    );
  } catch (err) {
    console.error("❌ Verification error:", err);
    res.status(500).send("Server error during email verification.");
  }
});

/* -------------------------------------------------------------------------- */
/* ✅ LOGIN (Added 'Credentials not found' message)                           */
/* -------------------------------------------------------------------------- */
router.post("/login", async (req: Request, res: Response) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success)
      return res
        .status(400)
        .json({ message: parsed.error.errors[0]?.message || "Invalid input" });

    const email = parsed.data.email.toLowerCase().trim();
    const password = parsed.data.password.trim();

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user)
      return res.status(404).json({ message: "Credentials not found" });

    if (!user.isVerified)
      return res.status(400).json({ message: "Please verify your email first" });

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid)
      return res.status(400).json({ message: "Invalid email or password" });

    const token = generateToken(user);
    res.status(200).json({
      message: "✅ Login successful",
      token,
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (err) {
    console.error("❌ Login error:", err);
    res.status(500).json({ message: "Server error during login" });
  }
});

/* -------------------------------------------------------------------------- */
/* ✅ FORGOT PASSWORD (Added 'Credentials not found' message)                 */
/* -------------------------------------------------------------------------- */
router.post("/forgot-password", async (req: Request, res: Response) => {
  try {
    const parsed = forgotPasswordSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ message: "Valid email required" });

    const email = parsed.data.email.toLowerCase().trim();
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user)
      return res.status(404).json({ message: "Credentials not found" });

    if (user.resetTokenExpiry && user.resetTokenExpiry > new Date())
      return res
        .status(429)
        .json({ message: "Please wait before requesting another OTP" });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedOtp = await bcrypt.hash(otp, 10);
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken: hashedOtp, resetTokenExpiry: otpExpiry },
    });

    await sendPasswordResetEmail(email, otp);
    console.log(`🔑 OTP sent to ${email}`);
    res.status(200).json({ message: "OTP sent to your email." });
  } catch (err) {
    console.error("❌ Forgot password error:", err);
    res.status(500).json({ message: "Error sending OTP" });
  }
});

/* -------------------------------------------------------------------------- */
/* ✅ OTP VERIFY + RESET PASSWORD ROUTES (No change needed)                   */
/* -------------------------------------------------------------------------- */
router.post("/verify-otp", async (req: Request, res: Response) => {
  try {
    const parsed = verifyOtpSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ message: "Invalid input" });

    const email = parsed.data.email.toLowerCase().trim();
    const { otp } = parsed.data;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.resetToken || !user.resetTokenExpiry)
      return res.status(400).json({ message: "Invalid or expired OTP" });

    const isOtpValid = await bcrypt.compare(otp, user.resetToken);
    if (!isOtpValid || user.resetTokenExpiry < new Date())
      return res.status(400).json({ message: "Invalid or expired OTP" });

    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken: null, resetTokenExpiry: null },
    });

    console.log(`✅ OTP verified for ${email}`);
    res.status(200).json({ message: "✅ OTP verified successfully." });
  } catch (err) {
    console.error("❌ Verify OTP error:", err);
    res.status(500).json({ message: "Error verifying OTP" });
  }
});

router.post("/reset-password", async (req: Request, res: Response) => {
  try {
    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ message: "Invalid input" });

    const email = parsed.data.email.toLowerCase().trim();
    const { otp, newPassword, confirmPassword } = parsed.data;
    if (newPassword !== confirmPassword)
      return res.status(400).json({ message: "Passwords do not match" });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.resetToken || !user.resetTokenExpiry)
      return res.status(400).json({ message: "Invalid or expired OTP" });

    const isOtpValid = await bcrypt.compare(otp, user.resetToken);
    if (!isOtpValid || user.resetTokenExpiry < new Date())
      return res.status(400).json({ message: "Invalid or expired OTP" });

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    console.log(`🔐 Password reset for ${email}`);
    res
      .status(200)
      .json({ message: "✅ Password updated successfully. Redirect to login." });
  } catch (err) {
    console.error("❌ Reset password error:", err);
    res.status(500).json({ message: "Error resetting password" });
  }
});

/* -------------------------------------------------------------------------- */
/* ✅ PROTECTED USER ROUTE                                                    */
/* -------------------------------------------------------------------------- */
router.get("/me", async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader)
      return res.status(401).json({ message: "No token provided" });

    const token = authHeader.split(" ")[1];
    const jwtSecret: Secret = process.env.JWT_SECRET as Secret;
    const decoded = jwt.verify(token, jwtSecret) as { id: number; email: string };

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
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
