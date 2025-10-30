"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const crypto_1 = __importDefault(require("crypto"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const dotenv_1 = __importDefault(require("dotenv"));
const prismaClient_1 = require("../prismaClient");
const email_1 = require("../utils/email");
const authSchemas_1 = require("../validation/authSchemas");
dotenv_1.default.config();
const router = express_1.default.Router();
/* -------------------------------------------------------------------------- */
/* Helper: Generate JWT Token                                                 */
/* -------------------------------------------------------------------------- */
const generateToken = (user) => {
    const jwtSecret = process.env.JWT_SECRET;
    const options = { expiresIn: "7d" }; // longer session life
    // ✅ FIXED: include `id` not `userId`
    return jsonwebtoken_1.default.sign({ id: user.id, email: user.email }, jwtSecret, options);
};
/* -------------------------------------------------------------------------- */
/* SIGNUP ROUTE                                                               */
/* -------------------------------------------------------------------------- */
router.post("/signup", async (req, res) => {
    try {
        const parsed = authSchemas_1.signupSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid input" });
        }
        const { name, email, password } = parsed.data;
        const existingUser = await prismaClient_1.prisma.user.findUnique({ where: { email } });
        if (existingUser)
            return res.status(400).json({ message: "User already exists" });
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        const verificationToken = crypto_1.default.randomBytes(32).toString("hex");
        await prismaClient_1.prisma.user.create({
            data: { name, email, passwordHash: hashedPassword, verificationToken, isVerified: false },
        });
        await (0, email_1.sendVerificationEmail)(email, verificationToken);
        res.status(201).json({ message: "Signup successful! Please check your email to verify your account." });
    }
    catch (err) {
        console.error("❌ Signup error:", err);
        res.status(500).json({ message: "Server error during signup" });
    }
});
/* -------------------------------------------------------------------------- */
/* EMAIL VERIFICATION ROUTE                                                   */
/* -------------------------------------------------------------------------- */
router.get("/verify/:token", async (req, res) => {
    try {
        const { token } = req.params;
        const user = await prismaClient_1.prisma.user.findFirst({ where: { verificationToken: token } });
        if (!user)
            return res.status(400).send("Invalid or expired verification link.");
        await prismaClient_1.prisma.user.update({
            where: { id: user.id },
            data: { isVerified: true, verificationToken: null },
        });
        await (0, email_1.sendWelcomeEmail)(user.email);
        await (0, email_1.sendAdminNotification)(user.name ?? "User", user.email ?? "");
        res.send(`<h2 style="font-family:sans-serif;">✅ Email verified successfully! You can now log in.</h2>`);
    }
    catch (err) {
        console.error("❌ Verification error:", err);
        res.status(500).send("Server error during email verification.");
    }
});
/* -------------------------------------------------------------------------- */
/* LOGIN ROUTE                                                                */
/* -------------------------------------------------------------------------- */
router.post("/login", async (req, res) => {
    try {
        const parsed = authSchemas_1.loginSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid input" });
        }
        const { email, password } = parsed.data;
        const user = await prismaClient_1.prisma.user.findUnique({ where: { email } });
        if (!user)
            return res.status(400).json({ message: "Invalid email or password" });
        if (!user.isVerified)
            return res.status(400).json({ message: "Please verify your email first" });
        const isPasswordValid = await bcryptjs_1.default.compare(password, user.passwordHash);
        if (!isPasswordValid)
            return res.status(400).json({ message: "Invalid email or password" });
        const token = generateToken(user);
        // ✅ Response: consistent with frontend expectations
        res.status(200).json({
            message: "✅ Login successful",
            token,
            user: { id: user.id, name: user.name, email: user.email },
        });
    }
    catch (err) {
        console.error("❌ Login error:", err);
        res.status(500).json({ message: "Server error during login" });
    }
});
/* -------------------------------------------------------------------------- */
/* FORGOT PASSWORD                                                            */
/* -------------------------------------------------------------------------- */
router.post("/forgot-password", async (req, res) => {
    try {
        const { email } = req.body;
        if (!email)
            return res.status(400).json({ message: "Email is required" });
        const user = await prismaClient_1.prisma.user.findUnique({ where: { email } });
        if (!user)
            return res.status(404).json({ message: "No user found with this email" });
        const resetToken = crypto_1.default.randomBytes(32).toString("hex");
        const tokenExpiry = new Date(Date.now() + 3600000); // 1 hour
        await prismaClient_1.prisma.user.update({
            where: { id: user.id },
            data: { resetToken, resetTokenExpiry: tokenExpiry },
        });
        await (0, email_1.sendPasswordResetEmail)(email, resetToken);
        res.status(200).json({ message: "Password reset link sent to your email." });
    }
    catch (err) {
        console.error("❌ Forgot password error:", err);
        res.status(500).json({ message: "Error sending password reset email" });
    }
});
/* -------------------------------------------------------------------------- */
/* RESET PASSWORD                                                             */
/* -------------------------------------------------------------------------- */
router.post("/reset-password/:token", async (req, res) => {
    try {
        const { token } = req.params;
        const { newPassword } = req.body;
        if (!newPassword)
            return res.status(400).json({ message: "New password is required" });
        const user = await prismaClient_1.prisma.user.findFirst({
            where: { resetToken: token, resetTokenExpiry: { gt: new Date() } },
        });
        if (!user)
            return res.status(400).json({ message: "Invalid or expired reset token" });
        const hashedPassword = await bcryptjs_1.default.hash(newPassword, 10);
        await prismaClient_1.prisma.user.update({
            where: { id: user.id },
            data: { passwordHash: hashedPassword, resetToken: null, resetTokenExpiry: null },
        });
        res.status(200).json({ message: "✅ Password reset successful! You can now log in." });
    }
    catch (err) {
        console.error("❌ Reset password error:", err);
        res.status(500).json({ message: "Error resetting password" });
    }
});
/* -------------------------------------------------------------------------- */
/* PROTECTED ROUTE (ME)                                                       */
/* -------------------------------------------------------------------------- */
router.get("/me", async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader)
            return res.status(401).json({ message: "No token provided" });
        const token = authHeader.split(" ")[1];
        const jwtSecret = process.env.JWT_SECRET;
        const decoded = jsonwebtoken_1.default.verify(token, jwtSecret);
        const user = await prismaClient_1.prisma.user.findUnique({
            where: { id: decoded.id },
            select: { id: true, name: true, email: true },
        });
        if (!user)
            return res.status(404).json({ message: "User not found" });
        res.json(user);
    }
    catch (err) {
        console.error("❌ Protected route error:", err);
        res.status(401).json({ message: "Invalid or expired token" });
    }
});
exports.default = router;
