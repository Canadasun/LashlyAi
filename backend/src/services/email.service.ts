import { logger } from "../utils/logger";

/**
 * Transactional email via Resend's HTTP API (no SDK dependency, same fetch-based
 * pattern as appleSignIn.service.ts's JWKS calls). Stub-safe like storage.service.ts's
 * AWS S3 fallback: without RESEND_API_KEY configured, sendEmail logs and no-ops instead
 * of throwing — notifications are best-effort side effects, never something that should
 * take down registration, a subscription grant, or any other primary action.
 */

const RESEND_API_URL = "https://api.resend.com/emails";

const apiKey = process.env.RESEND_API_KEY;
const fromAddress = process.env.EMAIL_FROM_ADDRESS ?? "LashlyAI <support@lashlyai.com>";

export const emailDeliveryConfigured = Boolean(apiKey);

if (!emailDeliveryConfigured) {
  logger.warn(
    "[email.service] RESEND_API_KEY is not set — emails will be logged, not delivered.",
  );
}

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export async function sendEmail(input: SendEmailInput): Promise<void> {
  if (!emailDeliveryConfigured) {
    logger.info(`[email.service] (stub) would send "${input.subject}" to ${input.to}`);
    return;
  }

  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromAddress,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend API error (${response.status}): ${body}`);
  }
}

/**
 * Every call site wraps sendEmail in this — a failed notification (bad provider
 * config, a transient network blip, an invalid recipient) should never fail or roll
 * back the primary action (registration, a subscription grant, etc.) that triggered it.
 */
export async function sendEmailBestEffort(input: SendEmailInput): Promise<void> {
  try {
    await sendEmail(input);
  } catch (err) {
    logger.error(`[email.service] Failed to send "${input.subject}" to ${input.to}`, err);
  }
}
