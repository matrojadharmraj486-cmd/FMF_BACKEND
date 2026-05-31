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

export const buildOtpEmail = ({ userName, otpCode, ttlMinutes = 10 } = {}) => {
  const name = userName ? String(userName).trim() : "there";
  const otp = String(otpCode || "").trim();
  const minutes = Number(ttlMinutes) || 10;

  const subject = "Your OTP";
  const text = `Hi ${name},

Welcome to FMF – Family Medicine Flashback

Your OTP: ${otp}

This OTP is valid for the next ${minutes} minutes. Please do not share it with anyone.

If you didn’t request this, you can safely ignore this email.

Warm regards,
Team FMF
Family Medicine Flashback`;

  const html = wrapHtml({
    title: subject,
    contentHtml: `
      <div style="font-size:14px;color:#111827;line-height:1.7;">
        <div>Hi <b>${escapeHtml(name)}</b>,</div>
        <p style="margin:12px 0 0 0;">Welcome to <b>FMF – Family Medicine Flashback</b>.</p>
        <p style="margin:12px 0 0 0;">To complete your registration, please use the One-Time Password (OTP) below:</p>
        <div style="margin:16px 0;padding:14px 16px;background:#f3f4f6;border-radius:10px;font-size:22px;letter-spacing:2px;text-align:center;">
          <b>${escapeHtml(otp)}</b>
        </div>
        <p style="margin:0;">This OTP is valid for the next <b>${escapeHtml(minutes)}</b> minutes. Please do not share it with anyone.</p>
        <p style="margin:12px 0 0 0;">If you didn’t request this, you can safely ignore this email.</p>
      </div>
    `
  });

  return { subject, text, html };
};

export const buildSupportTicketCreatedEmail = ({ userName, ticketNumber, subject: ticketSubject, category, priority } = {}) => {
  const name = userName ? String(userName).trim() : "there";
  const subject = `Support Ticket Created: #${ticketNumber}`;
  const text = `Hi ${name},

Your support ticket has been created successfully.

Ticket Details:
- Ticket Number: #${ticketNumber}
- Subject: ${ticketSubject}
- Category: ${category}
- Priority: ${priority}

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
          <div><b>Ticket Details</b></div>
          <div style="margin-top:8px;"><b>Ticket Number:</b> #${escapeHtml(ticketNumber)}</div>
          <div><b>Subject:</b> ${escapeHtml(ticketSubject)}</div>
          <div><b>Category:</b> ${escapeHtml(category)}</div>
          <div><b>Priority:</b> ${escapeHtml(priority)}</div>
        </div>
        <p style="margin:12px 0 0 0;">Our team will review your request and get back to you as soon as possible.</p>
      </div>
    `
  });
  return { subject, text, html };
};

export const buildSupportTicketUpdatedEmail = ({ userName, ticketNumber, status, note } = {}) => {
  const name = userName ? String(userName).trim() : "there";
  const subject = `Support Ticket Updated: #${ticketNumber}`;
  const text = `Hi ${name},

Your support ticket #${ticketNumber} has been updated.

New Status: ${status}
${note ? `Note: ${note}` : ""}

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
          <div><b>Update Details</b></div>
          <div style="margin-top:8px;"><b>New Status:</b> ${escapeHtml(status)}</div>
          ${note ? `<div style="margin-top:4px;"><b>Note:</b> ${escapeHtml(note)}</div>` : ""}
        </div>
        <p style="margin:12px 0 0 0;">You can check the details in the app.</p>
      </div>
    `
  });
  return { subject, text, html };
};

export const buildSubscriptionActivatedEmail = ({ userName, planName, startDate, expiryDate } = {}) => {
  const name = userName ? String(userName).trim() : "there";
  const subject = "Subscription Activated";
  const text = `Hi ${name},

Thank you for choosing FMF – Family Medicine Flashback!

Your subscription has been successfully activated.

Subscription Details:
- Plan: ${planName || ""}
- Start Date: ${formatDate(startDate)}
- Expiry Date: ${formatDate(expiryDate)}

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
          <div><b>Subscription Details</b></div>
          <div style="margin-top:8px;">Plan: ${escapeHtml(planName || "")}</div>
          <div>Start Date: ${escapeHtml(formatDate(startDate))}</div>
          <div>Expiry Date: ${escapeHtml(formatDate(expiryDate))}</div>
        </div>
      </div>
    `
  });
  return { subject, text, html };
};

export const buildRenewalReminderEmail = ({ userName, expiryDate, renewalLink } = {}) => {
  const name = userName ? String(userName).trim() : "there";
  const subject = "Renew Your Subscription";
  const text = `Hi ${name},

Just a quick reminder that your subscription will expire on:
Expiry Date: ${formatDate(expiryDate)}

Renew now: ${renewalLink || ""}

Warm regards,
Team FMF
Family Medicine Flashback`;

  const html = wrapHtml({
    title: subject,
    contentHtml: `
      <div style="font-size:14px;color:#111827;line-height:1.7;">
        <div>Hi <b>${escapeHtml(name)}</b>,</div>
        <p style="margin:12px 0 0 0;">Just a quick reminder that your subscription will expire on:</p>
        <div style="margin:12px 0;padding:12px 14px;background:#fff7ed;border-radius:10px;border:1px solid #fed7aa;">
          <b>Expiry Date:</b> ${escapeHtml(formatDate(expiryDate))}
        </div>
        <p style="margin:12px 0 0 0;">👉 Renew now: <a href="${escapeHtml(renewalLink || "")}">${escapeHtml(renewalLink || "")}</a></p>
      </div>
    `
  });
  return { subject, text, html };
};

export const buildPasswordResetEmail = ({ userName, resetLink, ttlMinutes = 15 } = {}) => {
  const name = userName ? String(userName).trim() : "there";
  const minutes = Number(ttlMinutes) || 15;
  const subject = "Reset Your Password";
  const text = `Hi ${name},

We received a request to reset your password.

Reset link (valid for ${minutes} minutes):
${resetLink || ""}

If you did not request a password reset, please ignore this email.

Best regards,
Team FMF
Family Medicine Flashback`;

  const html = wrapHtml({
    title: subject,
    contentHtml: `
      <div style="font-size:14px;color:#111827;line-height:1.7;">
        <div>Hi <b>${escapeHtml(name)}</b>,</div>
        <p style="margin:12px 0 0 0;">We received a request to reset your password for your <b>FMF – Family Medicine Flashback</b> account.</p>
        <p style="margin:12px 0 0 0;">👉 <a href="${escapeHtml(resetLink || "")}">Reset Password</a></p>
        <p style="margin:12px 0 0 0;">This link is valid for <b>${escapeHtml(minutes)}</b> minutes.</p>
        <p style="margin:12px 0 0 0;">If you did not request a password reset, please ignore this email—your account remains secure.</p>
      </div>
    `
  });
  return { subject, text, html };
};

