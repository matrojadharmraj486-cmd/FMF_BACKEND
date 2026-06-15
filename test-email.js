import { buildWelcomeEmail, buildOtpEmail } from "./src/utils/emailTemplates.js";
import { sendEmail } from "./src/utils/email.js";
import { logger } from "./src/utils/logger.js";

const testEmail = "draxmatroja1905@yopmail.com"; // your test email

async function testWelcomeEmail() {
  logger.info("Testing welcome email...");
  
  const tpl = buildWelcomeEmail({ userName: "Test User" });
  logger.info("Template built", { subject: tpl.subject });
  
  try {
    const result = await sendEmail({
      to: testEmail,
      subject: tpl.subject,
      text: tpl.text,
      html: tpl.html
    });
    
    logger.info("✅ Test email sent!", { result });
  } catch (err) {
    logger.error("❌ Test email failed", { error: err.message, stack: err.stack });
  }
}

async function testOtpEmail() {
  logger.info("Testing OTP email...");
  
  const tpl = buildOtpEmail({ userName: "Test User", otpCode: "123456", ttlMinutes: 10 });
  logger.info("Template built", { subject: tpl.subject });
  
  try {
    const result = await sendEmail({
      to: testEmail,
      subject: tpl.subject,
      text: tpl.text,
      html: tpl.html
    });
    
    logger.info("✅ Test OTP email sent!", { result });
  } catch (err) {
    logger.error("❌ Test OTP email failed", { error: err.message, stack: err.stack });
  }
}

// Run tests
console.log("🧪 Starting email tests...");
await testWelcomeEmail();
// await testOtpEmail(); // uncomment to test OTP too
