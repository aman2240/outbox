import { env } from "../config/env";
import { getSenderById } from "../db/senders";
import { getSlackIntegrationByUserId } from "../db/slackIntegrations";

/**
 * Resolves which Slack webhook (if any) should receive a rate-limit
 * notification for a given sender.
 *
 * Always re-queries the DB (never caches) so that connecting/disconnecting
 * Slack via the OAuth flow in routes/slack.ts takes effect immediately,
 * without a redeploy or restart.
 */
async function resolveWebhookUrlForSender(senderId: string): Promise<string | null> {
  const sender = await getSenderById(senderId);

  if (sender?.owner_user_id) {
    const integration = await getSlackIntegrationByUserId(sender.owner_user_id);
    // The sender has an owning user with an opinion on this (connected or
    // explicitly disconnected) — respect it either way, no fallback.
    if (integration?.connected && integration.webhook_url) return integration.webhook_url;
    if (integration) return null;
  }

  // No owning user at all (e.g. senders created via /debug before any user
  // logged in) — fall back to the manual pre-OAuth test webhook, if set.
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
