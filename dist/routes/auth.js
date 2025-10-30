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
    const options = { expiresIn: "1h" };
    return jsonwebtoken_1.default.sign({ userId: String(user.id), email: user.email }, jwtSecret, options);
};
/* -------------------------------------------------------------------------- */
/* SIGNUP ROUTE                                                               */
/* -------------------------------------------------------------------------- */
router.post("/signup", async (req, res) => {
    try {
        const parsed = authSchemas_1.signupSchema.safeParse(req.body);
        if (!parsed.success) {
            return res
                .status(400)
                .json({ message: parsed.error.errors[0]?.message || "Invalid input" });
        }
        const { name, email, password } = parsed.data;
        const existingUser = await prismaClient_1.prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ message: "User already exists" });
        }
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        const verificationToken = crypto_1.default.randomBytes(32).toString("hex");
        await prismaClient_1.prisma.user.create({
            data: {
                name,
                email,
                passwordHash: hashedPassword,
                verificationToken,
                isVerified: false,
            },
        });
        await (0, email_1.sendVerificationEmail)(email, verificationToken);
        res.status(201).json({
            message: "Signup successful. Please verify your email.",
        });
    }
    catch (err) {
        console.error("Signup error:", err);
        res.status(500).json({ message: "Server error during signup" });
    }
});
/* -------------------------------------------------------------------------- */
/* EMAIL VERIFICATION ROUTE                                                   */
/* -------------------------------------------------------------------------- */
router.get("/verify/:token", async (req, res) => {
    try {
        const { token } = req.params;
        const user = await prismaClient_1.prisma.user.findFirst({
            where: { verificationToken: token },
        });
        if (!user) {
            return res.status(400).json({ message: "Invalid or expired token" });
        }
        await prismaClient_1.prisma.user.update({
            where: { id: user.id },
            data: {
                isVerified: true,
                verificationToken: null,
            },
        });
        await (0, email_1.sendWelcomeEmail)(user.email);
        await (0, email_1.sendAdminNotification)(user.name ?? "User", user.email ?? "");
        res.status(200).json({ message: "Email verified successfully." });
    }
    catch (err) {
        console.error("Verification error:", err);
        res.status(500).json({ message: "Server error during email verification" });
    }
});
/* -------------------------------------------------------------------------- */
/* LOGIN ROUTE                                                                */
/* -------------------------------------------------------------------------- */
router.post("/login", async (req, res) => {
    try {
        const parsed = authSchemas_1.loginSchema.safeParse(req.body);
        if (!parsed.success) {
            return res
                .status(400)
                .json({ message: parsed.error.errors[0]?.message || "Invalid input" });
        }
        const { email, password } = parsed.data;
        const user = await prismaClient_1.prisma.user.findUnique({ where: { email } });
        if (!user) {
            return res.status(400).json({ message: "Invalid email or password" });
        }
        if (!user.isVerified) {
            return res.status(400).json({ message: "Please verify your email first" });
        }
        const isPasswordValid = await bcryptjs_1.default.compare(password, user.passwordHash);
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
    }
    catch (err) {
        console.error("Login error:", err);
        res.status(500).json({ message: "Server error during login" });
    }
});
/* -------------------------------------------------------------------------- */
/* PROTECTED ROUTE                                                            */
/* -------------------------------------------------------------------------- */
router.get("/me", async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader)
            return res.status(401).json({ message: "No token provided" });
        const token = authHeader.split(" ")[1];
        const jwtSecret = process.env.JWT_SECRET;
        const decoded = jsonwebtoken_1.default.verify(token, jwtSecret);
        const userId = Number(decoded.userId);
        const user = await prismaClient_1.prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, name: true, email: true },
        });
        if (!user)
            return res.status(404).json({ message: "User not found" });
        res.json(user);
    }
    catch (err) {
        console.error("Protected route error:", err);
        res.status(401).json({ message: "Invalid or expired token" });
    }
});
exports.default = router;
