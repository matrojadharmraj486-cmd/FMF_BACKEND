const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const formatDate = (value) => {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
};

const wrapHtml = ({ title, contentHtml }) => {
  const safeTitle = escapeHtml(title);
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${safeTitle}</title>
  </head>
  <body style="margin:0;padding:0;background:#f6f7fb;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:640px;margin:0 auto;padding:24px;">
      <div style="background:#ffffff;border-radius:12px;padding:24px;border:1px solid #e7e9f3;">
        <div style="font-size:18px;font-weight:700;margin-bottom:12px;color:#111827;">FMF – Family Medicine Flashback</div>
        ${contentHtml}
        <div style="margin-top:24px;font-size:13px;color:#6b7280;line-height:1.6;">
          Warm regards,<br/>
          Team FMF<br/>
          Family Medicine Flashback
        </div>
      </div>
      <div style="text-align:center;margin-top:12px;color:#9ca3af;font-size:12px;">
        © ${new Date().getFullYear()} FMF – Family Medicine Flashback
      </div>
    </div>
  </body>
</html>`;
};

// 1. Welcome Email + OTP (Registration)
export const buildOtpEmail = ({ userName, otpCode, ttlMinutes = 10 } = {}) => {
  const name = userName ? String(userName).trim() : "there";
  const otp = String(otpCode || "").trim();
  const minutes = Number(ttlMinutes) || 10;

  const subject = "Welcome to FMF – Verify Your Email";
  const text = `Hi ${name},

Welcome to FMF – Family Medicine Flashback 👋

We're excited to have you onboard!

To complete your registration, please use the One-Time Password (OTP) below:

Your OTP: ${otp}

This OTP is valid for the next ${minutes} minutes. Please do not share it with anyone.

Once verified, you'll get full access to powerful learning tools designed to strengthen your medical knowledge.

If you didn't request this, you can safely ignore this email.

Warm regards,
Team FMF
Family Medicine Flashback`;

  const html = wrapHtml({
    title: subject,
    contentHtml: `
      <div style="font-size:14px;color:#111827;line-height:1.7;">
        <div>Hi <b>${escapeHtml(name)}</b>,</div>
        <p style="margin:12px 0 0 0;">Welcome to <b>FMF – Family Medicine Flashback</b> 👋</p>
        <p style="margin:12px 0 0 0;">We're excited to have you onboard!</p>
        <p style="margin:12px 0 0 0;">To complete your registration, please use the One-Time Password (OTP) below:</p>
        <p style="margin:16px 0 0 0;font-weight:700;">Your OTP: <span style="font-size:20px;">${escapeHtml(otp)}</span></p>
        <p style="margin:12px 0 0 0;">This OTP is valid for the next <b>${escapeHtml(minutes)} minutes</b>. Please do not share it with anyone.</p>
        <p style="margin:12px 0 0 0;">Once verified, you'll get full access to powerful learning tools designed to strengthen your medical knowledge.</p>
        <p style="margin:12px 0 0 0;">If you didn't request this, you can safely ignore this email.</p>
      </div>
    `
  });

  return { subject, text, html };
};

// 2. Welcome Email (separate from OTP - for when user is already verified)
export const buildWelcomeEmail = ({ userName } = {}) => {
  const name = userName ? String(userName).trim() : "there";
  const subject = "Welcome to FMF – You're In!";
  const text = `Hi ${name},

Welcome to FMF – Family Medicine Flashback! 🎉

We're so excited to have you join our community of medical learners.

Your account has been created successfully. You can now log in and start exploring all our learning features.

Warm regards,
Team FMF
Family Medicine Flashback`;

  const html = wrapHtml({
    title: subject,
    contentHtml: `
      <div style="font-size:14px;color:#111827;line-height:1.7;">
        <div>Hi <b>${escapeHtml(name)}</b>,</div>
        <p style="margin:12px 0 0 0;">Welcome to <b>FMF – Family Medicine Flashback</b>! 🎉</p>
        <p style="margin:12px 0 0 0;">We're so excited to have you join our community of medical learners.</p>
        <p style="margin:12px 0 0 0;">Your account has been created successfully. You can now log in and start exploring all our learning features.</p>
      </div>
    `
  });

  return { subject, text, html };
};

// 3. Subscription Purchase / Activation Email
export const buildSubscriptionActivatedEmail = ({ userName, planName, startDate, expiryDate } = {}) => {
  const name = userName ? String(userName).trim() : "there";
  const subject = "Your FMF Subscription is Now Active 🎉";
  const text = `Hi ${name},

Thank you for choosing FMF – Family Medicine Flashback!

Your subscription has been successfully activated ✅

Subscription Details:
• Plan: ${planName || ""}
• Start Date: ${formatDate(startDate)}
• Expiry Date: ${formatDate(expiryDate)}

You now have full access to all premium features, including:
• Flashback learning modules
• Clinical case insights
• Continuous updates in family medicine

Start exploring and make the most of your learning journey.

If you have any questions, feel free to reach out.

Best regards,
Team FMF
Family Medicine Flashback`;

  const html = wrapHtml({
    title: subject,
    contentHtml: `
      <div style="font-size:14px;color:#111827;line-height:1.7;">
        <div>Hi <b>${escapeHtml(name)}</b>,</div>
        <p style="margin:12px 0 0 0;">Thank you for choosing <b>FMF – Family Medicine Flashback</b>!</p>
        <p style="margin:12px 0 0 0;">Your subscription has been successfully activated ✅</p>
        <div style="margin:16px 0;padding:14px 16px;background:#f9fafb;border-radius:10px;border:1px solid #eef2ff;">
          <div style="font-weight:700;">Subscription Details:</div>
          <ul style="margin:8px 0 0 20px;">
            <li>Plan: ${escapeHtml(planName || "")}</li>
            <li>Start Date: ${escapeHtml(formatDate(startDate))}</li>
            <li>Expiry Date: ${escapeHtml(formatDate(expiryDate))}</li>
          </ul>
        </div>
        <p style="margin:12px 0 0 0;">You now have full access to all premium features, including:</p>
        <ul style="margin:8px 0 0 20px;">
          <li>Flashback learning modules</li>
          <li>Clinical case insights</li>
          <li>Continuous updates in family medicine</li>
        </ul>
        <p style="margin:12px 0 0 0;">Start exploring and make the most of your learning journey.</p>
        <p style="margin:12px 0 0 0;">If you have any questions, feel free to reach out.</p>
      </div>
    `
  });
  return { subject, text, html };
};

// 4. Renew Your Subscription Email
export const buildRenewalReminderEmail = ({ userName, expiryDate, renewalLink } = {}) => {
  const name = userName ? String(userName).trim() : "there";
  const subject = "Your FMF Subscription is Expiring Soon";
  const text = `Hi ${name},

We hope you've been enjoying your learning journey with FMF – Family Medicine Flashback.

Just a quick reminder that your subscription will expire on:

Expiry Date: ${formatDate(expiryDate)}

To continue uninterrupted access to all premium features, please renew your subscription before it expires.

Stay consistent. Keep learning. Stay ahead in your medical journey.

👉 Renew now: ${renewalLink || ""}

If you need any help, we're always here for you.

Warm regards,
Team FMF
Family Medicine Flashback`;

  const html = wrapHtml({
    title: subject,
    contentHtml: `
      <div style="font-size:14px;color:#111827;line-height:1.7;">
        <div>Hi <b>${escapeHtml(name)}</b>,</div>
        <p style="margin:12px 0 0 0;">We hope you've been enjoying your learning journey with <b>FMF – Family Medicine Flashback</b>.</p>
        <p style="margin:12px 0 0 0;">Just a quick reminder that your subscription will expire on:</p>
        <div style="margin:12px 0;padding:12px 14px;background:#fff7ed;border-radius:10px;border:1px solid #fed7aa;">
          <b>Expiry Date:</b> ${escapeHtml(formatDate(expiryDate))}
        </div>
        <p style="margin:12px 0 0 0;">To continue uninterrupted access to all premium features, please renew your subscription before it expires.</p>
        <p style="margin:12px 0 0 0;">Stay consistent. Keep learning. Stay ahead in your medical journey.</p>
        <p style="margin:12px 0 0 0;">👉 Renew now: <a href="${escapeHtml(renewalLink || "")}" style="color:#2563eb;text-decoration:underline;">${escapeHtml(renewalLink || "")}</a></p>
        <p style="margin:12px 0 0 0;">If you need any help, we're always here for you.</p>
      </div>
    `
  });
  return { subject, text, html };
};

// 5. Password Reset Email
export const buildPasswordResetEmail = ({ userName, resetLink, ttlMinutes = 15 } = {}) => {
  const name = userName ? String(userName).trim() : "there";
  const minutes = Number(ttlMinutes) || 15;
  const subject = "Reset Your FMF Password";
  const text = `Hi ${name},

We received a request to reset your password for your FMF – Family Medicine Flashback account.

Click the link below to reset your password:

👉 ${resetLink || ""}

This link is valid for ${minutes} minutes.

If you did not request a password reset, please ignore this email—your account remains secure.

Stay safe and keep learning!

Best regards,
Team FMF
Family Medicine Flashback`;

  const html = wrapHtml({
    title: subject,
    contentHtml: `
      <div style="font-size:14px;color:#111827;line-height:1.7;">
        <div>Hi <b>${escapeHtml(name)}</b>,</div>
        <p style="margin:12px 0 0 0;">We received a request to reset your password for your <b>FMF – Family Medicine Flashback</b> account.</p>
        <p style="margin:12px 0 0 0;">Click the link below to reset your password:</p>
        <p style="margin:12px 0 0 0;">👉 <a href="${escapeHtml(resetLink || "")}" style="color:#2563eb;text-decoration:underline;font-weight:700;">${escapeHtml(resetLink || "")}</a></p>
        <p style="margin:12px 0 0 0;">This link is valid for <b>${escapeHtml(minutes)} minutes</b>.</p>
        <p style="margin:12px 0 0 0;">If you did not request a password reset, please ignore this email—your account remains secure.</p>
        <p style="margin:12px 0 0 0;">Stay safe and keep learning!</p>
      </div>
    `
  });
  return { subject, text, html };
};

// 6. Subscription Expired Email (Optional but Recommended)
export const buildSubscriptionExpiredEmail = ({ userName, renewalLink } = {}) => {
  const name = userName ? String(userName).trim() : "there";
  const subject = "Your FMF Subscription Has Expired";
  const text = `Hi ${name},

Your subscription to FMF – Family Medicine Flashback has expired.

We hope you found value in your learning experience.

To regain access to premium features and continue your journey, renew your subscription anytime.

👉 Renew here: ${renewalLink || ""}

We'd love to have you back!

Best regards,
Team FMF
Family Medicine Flashback`;

  const html = wrapHtml({
    title: subject,
    contentHtml: `
      <div style="font-size:14px;color:#111827;line-height:1.7;">
        <div>Hi <b>${escapeHtml(name)}</b>,</div>
        <p style="margin:12px 0 0 0;">Your subscription to <b>FMF – Family Medicine Flashback</b> has expired.</p>
        <p style="margin:12px 0 0 0;">We hope you found value in your learning experience.</p>
        <p style="margin:12px 0 0 0;">To regain access to premium features and continue your journey, renew your subscription anytime.</p>
        <p style="margin:12px 0 0 0;">👉 Renew here: <a href="${escapeHtml(renewalLink || "")}" style="color:#2563eb;text-decoration:underline;">${escapeHtml(renewalLink || "")}</a></p>
        <p style="margin:12px 0 0 0;">We'd love to have you back!</p>
      </div>
    `
  });
  return { subject, text, html };
};

// 7. Support Ticket Created Email
export const buildSupportTicketCreatedEmail = ({ userName, ticketNumber, subject: ticketSubject, category, priority } = {}) => {
  const name = userName ? String(userName).trim() : "there";
  const subject = `Support Ticket Created: #${ticketNumber}`;
  const text = `Hi ${name},

Your support ticket has been created successfully.

Ticket Details:
• Ticket Number: #${ticketNumber}
• Subject: ${ticketSubject}
• Category: ${category}
• Priority: ${priority}

Our team will review your request and get back to you as soon as possible.

Best regards,
Team FMF
Family Medicine Flashback`;

  const html = wrapHtml({
    title: subject,
    contentHtml: `
      <div style="font-size:14px;color:#111827;line-height:1.7;">
        <div>Hi <b>${escapeHtml(name)}</b>,</div>
        <p style="margin:12px 0 0 0;">Your support ticket has been created successfully.</p>
        <div style="margin:16px 0;padding:14px 16px;background:#f9fafb;border-radius:10px;border:1px solid #eef2ff;">
          <div style="font-weight:700;">Ticket Details:</div>
          <ul style="margin:8px 0 0 20px;">
            <li>Ticket Number: #${escapeHtml(ticketNumber)}</li>
            <li>Subject: ${escapeHtml(ticketSubject)}</li>
            <li>Category: ${escapeHtml(category)}</li>
            <li>Priority: ${escapeHtml(priority)}</li>
          </ul>
        </div>
        <p style="margin:12px 0 0 0;">Our team will review your request and get back to you as soon as possible.</p>
      </div>
    `
  });
  return { subject, text, html };
};

// 8. Support Ticket Updated Email
export const buildSupportTicketUpdatedEmail = ({ userName, ticketNumber, status, note } = {}) => {
  const name = userName ? String(userName).trim() : "there";
  const subject = `Support Ticket Updated: #${ticketNumber}`;
  const text = `Hi ${name},

Your support ticket #${ticketNumber} has been updated.

Update Details:
• New Status: ${status}
${note ? `• Note: ${note}` : ""}

You can check the details in the app.

Best regards,
Team FMF
Family Medicine Flashback`;

  const html = wrapHtml({
    title: subject,
    contentHtml: `
      <div style="font-size:14px;color:#111827;line-height:1.7;">
        <div>Hi <b>${escapeHtml(name)}</b>,</div>
        <p style="margin:12px 0 0 0;">Your support ticket <b>#${escapeHtml(ticketNumber)}</b> has been updated.</p>
        <div style="margin:16px 0;padding:14px 16px;background:#f9fafb;border-radius:10px;border:1px solid #eef2ff;">
          <div style="font-weight:700;">Update Details:</div>
          <ul style="margin:8px 0 0 20px;">
            <li>New Status: ${escapeHtml(status)}</li>
            ${note ? `<li>Note: ${escapeHtml(note)}</li>` : ""}
          </ul>
        </div>
        <p style="margin:12px 0 0 0;">You can check the details in the app.</p>
      </div>
    `
  });
  return { subject, text, html };
};
