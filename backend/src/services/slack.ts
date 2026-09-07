import { queryOne } from "../db/client";
import { env } from "../config/env";

/**
 * Phase 3 simplification: senders aren't yet tied to a specific user (that
 * relationship — senders.owner_user_id — arrives in Phase 4 alongside real
 * Slack OAuth). Until then we treat this as effectively single-tenant: look
 * up whichever slack_integrations row is connected (acts as one default
 * workspace), falling back to a manually-configured webhook URL via
 * SLACK_TEST_WEBHOOK_URL for local testing before any OAuth flow exists.
 *
 * Always re-queries the DB (never caches) so that connecting/disconnecting
 * Slack takes effect immediately without a redeploy — required from Phase 4
 * onward, and harmless to do here too.
 */
async function resolveWebhookUrlForSender(_senderId: string): Promise<string | null> {
  const row = await queryOne<{ webhook_url: string | null }>(
    `SELECT webhook_url FROM slack_integrations WHERE connected = true AND webhook_url IS NOT NULL ORDER BY created_at ASC LIMIT 1`
  );
  if (row?.webhook_url) return row.webhook_url;

  return env.slackTestWebhookUrl ?? null;
}

export async function sendSlackNotification(senderId: string, message: string): Promise<void> {
  const webhookUrl = await resolveWebhookUrlForSender(senderId);

  if (!webhookUrl) {
    console.log(`[slack] no connected Slack integration for sender ${senderId} — skipping notification`);
    return;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: message }),
    });
    if (!response.ok) {
      console.error(`[slack] webhook responded with ${response.status}: ${await response.text()}`);
    }
  } catch (err) {
    // Never let a Slack failure affect email sending/scheduling.
    console.error("[slack] failed to send notification:", (err as Error).message);
  }
}
