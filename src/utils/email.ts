import Brevo from "@getbrevo/brevo";
import dotenv from "dotenv";
dotenv.config();

/* -------------------------------------------------------------------------- */
/* ✅ Initialize Brevo API Client                                             */
/* -------------------------------------------------------------------------- */
const apiKey = process.env.BREVO_API_KEY;
if (!apiKey) {
  console.error("❌ Missing BREVO_API_KEY in .env");
} else {
  const defaultClient = Brevo.ApiClient.instance;
  const apiKeyAuth = defaultClient.authentications["api-key"];
  apiKeyAuth.apiKey = apiKey;
  console.log("✅ Brevo API key attached successfully");
}

const brevoClient = new Brevo.TransactionalEmailsApi();

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
async function send(mail: {
  sender: { name: string; email: string };
  to: { email: string }[];
  subject: string;
  htmlContent: string;
}) {
  try {
    const res = await brevoClient.sendTransacEmail(mail);
    console.log(`📧 Email sent → ${mail.to[0].email} | ${mail.subject}`);
    console.log("📨 Brevo message ID:", (res as any)?.messageId || "N/A");
  } catch (err: any) {
    console.error(
      "⚠️ Brevo send error:\n",
      JSON.stringify(err.response?.body || err.message || err, null, 2)
    );
  }
}

/* -------------------------------------------------------------------------- */
/* ✅ Verification Email                                                      */
/* -------------------------------------------------------------------------- */
export async function sendVerificationEmail(toEmail: string, token: string) {
  // Use backend or frontend URL depending on how you verify
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
export async function sendWelcomeEmail(toEmail: string) {
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
export async function sendAdminNotification(userName: string, userEmail: string) {
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
/* ✅ Forgot Password Email                                                   */
/* -------------------------------------------------------------------------- */
export async function sendPasswordResetEmail(toEmail: string, token: string) {
  const baseUrl = process.env.FRONTEND_URL || process.env.BACKEND_URL || "http://localhost:4000";
  const resetUrl = `${baseUrl}/reset-password/${token}`;

  const mail = {
    sender: DEFAULT_SENDER,
    to: [{ email: toEmail }],
    subject: "Reset your MOVIEFLIX password 🔐",
    htmlContent: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px;background:#eef2f7;border-radius:10px;">
        <h2>Password Reset Request</h2>
        <p>We received a request to reset your password. Click below to set a new one:</p>
        <p style="text-align:center;">
          <a href="${resetUrl}" style="background:#007bff;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;">Reset My Password</a>
        </p>
        <p>If you didn’t request this, you can safely ignore this email.</p>
      </div>
    `,
  };
  await send(mail);
}
