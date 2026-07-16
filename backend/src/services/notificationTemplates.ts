/**
 * Message content for every alert/notification this app sends, kept in one place so
 * tone and structure stay consistent and there's a single spot to edit copy. Each
 * function returns plain data ({subject, html, text} for email, {body} for SMS) — the
 * actual sending (and its best-effort/never-fail-the-caller contract) lives in
 * email.service.ts / sms.service.ts.
 */

const BRAND = "LashlyAI";

// Where operational alerts (new forum reports, unhandled server errors) go — a real
// support inbox exists already; the phone number is optional, so SMS alerts are simply
// skipped (see sms.service.ts's stub) until one is configured.
export const ADMIN_ALERT_EMAIL = process.env.ADMIN_ALERT_EMAIL ?? "support@lashlyai.com";
export const ADMIN_ALERT_PHONE_NUMBER = process.env.ADMIN_ALERT_PHONE_NUMBER;

function wrapHtml(bodyHtml: string): string {
  return `<!doctype html>
<html>
<body style="font-family: -apple-system, 'Segoe UI', sans-serif; background: #FAF7F4; padding: 32px; color: #241D20;">
  <div style="max-width: 480px; margin: 0 auto; background: #FFFFFF; border-radius: 14px; padding: 32px;">
    <div style="font-weight: 800; font-size: 18px; color: #B85C7A; margin-bottom: 20px;">${BRAND}</div>
    ${bodyHtml}
  </div>
</body>
</html>`;
}

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

export function welcomeEmail(): EmailContent {
  const subject = `Welcome to ${BRAND}`;
  const text =
    `Welcome to ${BRAND}!\n\n` +
    `Photograph a client's eye, get an AI-generated lash map, and start building your ` +
    `client book. If you ever get stuck, the AI Lash Coach is one tap away.\n\n` +
    `Questions? Reply to this email or reach us at support@lashlyai.com.`;
  const html = wrapHtml(
    `<p style="font-size:16px; line-height:1.6;">Welcome to ${BRAND}!</p>
     <p style="font-size:14px; line-height:1.6; color:#342B2F;">
       Photograph a client's eye, get an AI-generated lash map, and start building your
       client book. If you ever get stuck, the AI Lash Coach is one tap away.
     </p>
     <p style="font-size:13px; color:#746A6E;">Questions? Reply to this email or reach us at support@lashlyai.com.</p>`,
  );
  return { subject, html, text };
}

export function compGrantEmail(plan: string, expiresAt: string): EmailContent {
  const expiresDate = new Date(expiresAt).toLocaleDateString();
  const subject = `You've got complimentary ${plan} access on ${BRAND}`;
  const text =
    `You've been gifted ${plan} access on ${BRAND}, through ${expiresDate}.\n\n` +
    `Open the app to start using it.`;
  const html = wrapHtml(
    `<p style="font-size:16px; line-height:1.6;">You've got complimentary ${plan} access! 🎉</p>
     <p style="font-size:14px; line-height:1.6; color:#342B2F;">
       Your complimentary ${plan} access on ${BRAND} runs through <strong>${expiresDate}</strong>.
       Open the app to start using it.
     </p>`,
  );
  return { subject, html, text };
}

export function compRevokeEmail(plan: string): EmailContent {
  const subject = `Your complimentary ${plan} access has ended`;
  const text = `Your complimentary ${plan} access on ${BRAND} is no longer active.`;
  const html = wrapHtml(
    `<p style="font-size:16px; line-height:1.6;">Your complimentary access has ended</p>
     <p style="font-size:14px; line-height:1.6; color:#342B2F;">
       Your complimentary ${plan} access on ${BRAND} is no longer active. You can upgrade
       any time from the app's Subscription screen.
     </p>`,
  );
  return { subject, html, text };
}

export function subscriptionExpiredEmail(plan: string): EmailContent {
  const subject = `Your ${BRAND} ${plan} subscription has expired`;
  const text =
    `Your ${plan} subscription on ${BRAND} has expired. Renew any time from the app's ` +
    `Subscription screen to get back your unlimited access.`;
  const html = wrapHtml(
    `<p style="font-size:16px; line-height:1.6;">Your ${plan} subscription has expired</p>
     <p style="font-size:14px; line-height:1.6; color:#342B2F;">
       Renew any time from the app's Subscription screen to get back your unlimited access.
     </p>`,
  );
  return { subject, html, text };
}

export function adminNewForumReportEmail(input: {
  targetType: string;
  reason: string;
  reportId: string;
}): EmailContent {
  const subject = `[${BRAND}] New forum report: ${input.targetType}`;
  const text =
    `A ${input.targetType} was reported on ${BRAND}.\n\nReason: ${input.reason}\n\n` +
    `Review and resolve it from the admin dashboard.`;
  const html = wrapHtml(
    `<p style="font-size:16px; line-height:1.6;">New forum report</p>
     <p style="font-size:14px; line-height:1.6; color:#342B2F;">
       A <strong>${input.targetType}</strong> was reported.<br/>
       Reason: ${input.reason}
     </p>
     <p style="font-size:13px; color:#746A6E;">Review and resolve it from the admin dashboard.</p>`,
  );
  return { subject, html, text };
}

export function adminNewForumReportSms(targetType: string): string {
  return `${BRAND} alert: a ${targetType} was just reported on the forum. Check the admin dashboard.`;
}

export function adminErrorAlertSms(path: string): string {
  return `${BRAND} alert: an unhandled server error just occurred on ${path}. Check the admin dashboard's Recent Errors.`;
}
