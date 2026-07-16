import { logger } from "../utils/logger";

/**
 * SMS via Twilio's REST API (Basic Auth, no SDK dependency — same fetch-based pattern
 * as email.service.ts and appleSignIn.service.ts). Stub-safe: without Twilio
 * credentials configured, sendSms logs and no-ops rather than throwing.
 */

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_FROM_NUMBER;

export const smsDeliveryConfigured = Boolean(accountSid && authToken && fromNumber);

if (!smsDeliveryConfigured) {
  logger.warn(
    "[sms.service] TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN/TWILIO_FROM_NUMBER are not fully " +
      "set — SMS alerts will be logged, not delivered.",
  );
}

export interface SendSmsInput {
  to: string;
  body: string;
}

export async function sendSms(input: SendSmsInput): Promise<void> {
  if (!smsDeliveryConfigured) {
    logger.info(`[sms.service] (stub) would text "${input.body}" to ${input.to}`);
    return;
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const basicAuth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  const params = new URLSearchParams({ To: input.to, From: fromNumber!, Body: input.body });

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Twilio API error (${response.status}): ${body}`);
  }
}

/**
 * Same "never fail the primary action" contract as email.service.ts's
 * sendEmailBestEffort — an alert failing to send should never take down whatever
 * triggered it.
 */
export async function sendSmsBestEffort(input: SendSmsInput): Promise<void> {
  try {
    await sendSms(input);
  } catch (err) {
    logger.error(`[sms.service] Failed to text ${input.to}`, err);
  }
}
