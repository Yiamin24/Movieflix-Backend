"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendVerificationEmail = sendVerificationEmail;
exports.sendWelcomeEmail = sendWelcomeEmail;
exports.sendAdminNotification = sendAdminNotification;
exports.sendPasswordResetEmail = sendPasswordResetEmail;
const brevo_1 = __importDefault(require("@getbrevo/brevo"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
/* -------------------------------------------------------------------------- */
/* ✅ Initialize Brevo API Client                                             */
/* -------------------------------------------------------------------------- */
const apiKey = process.env.BREVO_API_KEY;
if (!apiKey) {
    console.error("❌ Missing BREVO_API_KEY in .env");
}
else {
    const defaultClient = brevo_1.default.ApiClient.instance;
    const apiKeyAuth = defaultClient.authentications["api-key"];
    apiKeyAuth.apiKey = apiKey;
    console.log("✅ Brevo API key attached successfully");
}
const brevoClient = new brevo_1.default.TransactionalEmailsApi();
/* -------------------------------------------------------------------------- */
/* ✅ Default Sender                                                          */
/* -------------------------------------------------------------------------- */
const DEFAULT_SENDER = {
    name: "MOVIEFLIX",
    email: process.env.SENDER_EMAIL || "syash7545@gmail.com",
};
/* -------------------------------------------------------------------------- */
/* ✅ Generic Email Send Helper                                               */
/* -------------------------------------------------------------------------- */
async function send(mail) {
    try {
        const res = await brevoClient.sendTransacEmail(mail);
        console.log(`📧 Email sent → ${mail.to[0].email} | ${mail.subject}`);
        console.log("📨 Brevo message ID:", res?.messageId || "N/A");
    }
    catch (err) {
        console.error("⚠️ Brevo send error:\n", JSON.stringify(err.response?.body || err.message || err, null, 2));
    }
}
/* -------------------------------------------------------------------------- */
/* ✅ Verification Email                                                      */
/* -------------------------------------------------------------------------- */
async function sendVerificationEmail(toEmail, token) {
    const baseUrl = process.env.BACKEND_URL || process.env.APP_URL || "http://localhost:4000";
    const verifyUrl = `${baseUrl}/api/auth/verify/${token}`;
    const mail = {
        sender: DEFAULT_SENDER,
        to: [{ email: toEmail }],
        subject: "Verify your MOVIEFLIX account",
        htmlContent: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px;background:#f9f9f9;border-radius:10px;">
        <h2 style="color:#e50914;">Welcome to MOVIEFLIX 🎬</h2>
        <p>Click below to verify your email:</p>
        <p style="text-align:center;">
          <a href="${verifyUrl}" style="background:#e50914;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;">Verify My Account</a>
        </p>
        <p>This link will expire soon.</p>
      </div>
    `,
    };
    await send(mail);
}
/* -------------------------------------------------------------------------- */
/* ✅ Welcome Email                                                           */
/* -------------------------------------------------------------------------- */
async function sendWelcomeEmail(toEmail) {
    const mail = {
        sender: DEFAULT_SENDER,
        to: [{ email: toEmail }],
        subject: "Welcome to MOVIEFLIX! 🎉",
        htmlContent: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px;background:#f1f1f1;border-radius:10px;">
        <h1 style="color:#e50914;">Welcome to MOVIEFLIX!</h1>
        <p>We’re thrilled to have you on board. Start exploring great movies and shows 🚀</p>
      </div>
    `,
    };
    await send(mail);
}
/* -------------------------------------------------------------------------- */
/* ✅ Admin Notification Email                                                */
/* -------------------------------------------------------------------------- */
async function sendAdminNotification(userName, userEmail) {
    const adminEmail = process.env.ADMIN_EMAIL || DEFAULT_SENDER.email;
    const mail = {
        sender: DEFAULT_SENDER,
        to: [{ email: adminEmail }],
        subject: "🎉 New User Registered on MovieFlix",
        htmlContent: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px;background:#fffbe6;border-radius:10px;">
        <h2>New User Signup Alert</h2>
        <p><b>${userName}</b> has just registered.</p>
        <p>Email: <b>${userEmail}</b></p>
        <hr/>
        <p><small>${new Date().toLocaleString()}</small></p>
      </div>
    `,
    };
    await send(mail);
}
/* -------------------------------------------------------------------------- */
/* ✅ OTP-Based Forgot Password Email                                         */
/* -------------------------------------------------------------------------- */
async function sendPasswordResetEmail(toEmail, otp) {
    const mail = {
        sender: DEFAULT_SENDER,
        to: [{ email: toEmail }],
        subject: "Your MOVIEFLIX Password Reset OTP 🔐",
        htmlContent: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:25px;background:#eef2f7;border-radius:10px;text-align:center;">
        <h2 style="color:#e50914;">Password Reset Request</h2>
        <p style="font-size:16px;">Use the following OTP to reset your password:</p>
        <div style="font-size:28px;font-weight:bold;letter-spacing:4px;color:#333;margin:20px 0;">${otp}</div>
        <p>This OTP will expire in <b>10 minutes</b>.</p>
        <hr style="margin:20px 0;border:none;border-top:1px solid #ccc;"/>
        <p style="font-size:13px;color:#666;">If you didn’t request this, please ignore this email.</p>
      </div>
    `,
    };
    await send(mail);
}
