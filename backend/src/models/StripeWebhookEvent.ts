import { pool } from "../db";

/**
 * Checked before processing, recorded after — see billing.routes.ts's webhook
 * handler. Marking "processed" only once handleStripeEvent has actually succeeded
 * means a transient failure mid-processing doesn't get remembered as done, so
 * Stripe's automatic retry on a non-2xx response actually reprocesses the event
 * instead of being silently deduped away.
 */
export async function isStripeWebhookEventAlreadyProcessed(eventId: string): Promise<boolean> {
  const result = await pool.query("SELECT 1 FROM stripe_webhook_events WHERE id = $1", [eventId]);
  return (result.rowCount ?? 0) > 0;
}

export async function markStripeWebhookEventProcessed(
  eventId: string,
  eventType: string,
): Promise<void> {
  await pool.query(
    `INSERT INTO stripe_webhook_events (id, type) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
    [eventId, eventType],
  );
}
