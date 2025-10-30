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

  return jwt.sign(
    { userId: String(user.id), email: user.email },
    jwtSecret,
    options
  );
};

/* -------------------------------------------------------------------------- */
/* SIGNUP ROUTE                                                               */
/* -------------------------------------------------------------------------- */
router.post("/signup", async (req: Request, res: Response) => {
  try {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ message: parsed.error.errors[0]?.message || "Invalid input" });
    }

    const { name, email, password } = parsed.data;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

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

    res.status(201).json({
      message: "Signup successful. Please verify your email.",
    });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ message: "Server error during signup" });
  }
});

/* -------------------------------------------------------------------------- */
/* EMAIL VERIFICATION ROUTE                                                   */
/* -------------------------------------------------------------------------- */
router.get("/verify/:token", async (req: Request, res: Response) => {
  try {
    const { token } = req.params;

    const user = await prisma.user.findFirst({
      where: { verificationToken: token },
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        isVerified: true,
        verificationToken: null,
      },
    });

    await sendWelcomeEmail(user.email);
    await sendAdminNotification(user.name ?? "User", user.email ?? "");

    res.status(200).json({ message: "Email verified successfully." });
  } catch (err) {
    console.error("Verification error:", err);
    res.status(500).json({ message: "Server error during email verification" });
  }
});

/* -------------------------------------------------------------------------- */
/* LOGIN ROUTE                                                                */
/* -------------------------------------------------------------------------- */
router.post("/login", async (req: Request, res: Response) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ message: parsed.error.errors[0]?.message || "Invalid input" });
    }

    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    if (!user.isVerified) {
      return res.status(400).json({ message: "Please verify your email first" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    const token = generateToken(user);

    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Server error during login" });
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
    console.error("Protected route error:", err);
    res.status(401).json({ message: "Invalid or expired token" });
  }
});

export default router;
