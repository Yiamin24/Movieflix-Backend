import Brevo from "@getbrevo/brevo";
import dotenv from "dotenv";
dotenv.config();


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

const DEFAULT_SENDER = {
  name: "MOVIEFLIX",
  email: process.env.SENDER_EMAIL || "syash7545@gmail.com", 
};

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
    console.error("⚠️ Brevo send error:\n", JSON.stringify(err.response?.body || err.message || err, null, 2));
    console.warn(`📨 [LOCAL MOCK] Email not sent, logged for ${mail.to[0].email} | ${mail.subject}`);
  }
}

export async function sendVerificationEmail(toEmail: string, verifyUrl: string) {
  const mail = {
    sender: DEFAULT_SENDER,
    to: [{ email: toEmail }],
    subject: "Verify your MOVIEFLIX account",
    htmlContent: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px;
                  border-radius:12px;background:#f9f9f9;">
        <h2 style="color:#333;">Welcome to MOVIEFLIX 🎬</h2>
        <p>Hi there 👋</p>
        <p>Click the button below to verify your account:</p>
        <p style="text-align:center;">
          <a href="${verifyUrl}" 
             style="background:#007bff;color:white;padding:10px 20px;text-decoration:none;
                    border-radius:5px;">Verify My Account</a>
        </p>
        <p>This link will expire in <b>24 hours</b>.</p>
        <p>– The MovieFlix Team</p>
      </div>
    `,
  };
  await send(mail);
}

export async function sendWelcomeEmail(toEmail: string) {
  const mail = {
    sender: DEFAULT_SENDER,
    to: [{ email: toEmail }],
    subject: "Welcome to MOVIEFLIX! 🎉",
    htmlContent: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px;
                  border-radius:12px;background:#f1f1f1;">
        <h1 style="color:#e50914;">Welcome to MOVIEFLIX!</h1>
        <p>We're thrilled to have you on board.</p>
        <p>Start exploring movies, shows, and much more 🚀</p>
        <p>– Team MovieFlix</p>
      </div>
    `,
  };
  await send(mail);
}

export async function sendAdminNotification(subject: string, text: string) {
  const adminEmail = process.env.ADMIN_EMAIL || DEFAULT_SENDER.email;
  const mail = {
    sender: DEFAULT_SENDER,
    to: [{ email: adminEmail }],
    subject,
    htmlContent: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px;
                  border-radius:12px;background:#fffbe6;">
        <h2>📢 New User Signup</h2>
        <p>${text}</p>
        <hr/>
        <p><b>Time:</b> ${new Date().toLocaleString()}</p>
        <p>– MovieFlix System</p>
      </div>
    `,
  };
  await send(mail);
}

if (require.main === module) {
  (async () => {
    console.log("🚀 Sending test email via Brevo...");
    console.log("🔑 BREVO_API_KEY:", apiKey ? "✅ Loaded" : "❌ Missing");
    console.log("📤 Using sender:", DEFAULT_SENDER.email);

    const testUrl = `${process.env.APP_URL || "http://localhost:4000"}/api/auth/verify?token=TESTTOKEN`;
    await sendVerificationEmail("yourtestemail@example.com", testUrl);
    await sendAdminNotification("New user signup", "Test notification to admin.");

    console.log("✅ Test emails attempted.");
  })();
}
