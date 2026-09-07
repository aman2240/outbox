import { Router } from "express";
import crypto from "crypto";
import { env } from "../config/env";
import { requireAuth } from "../middleware/requireAuth";
import { upsertSlackIntegrationForUser, getSlackIntegrationByUserId, setSlackIntegrationConnected } from "../db/slackIntegrations";

export const slackRouter = Router();

// The OAuth `state` param round-trips through Slack's servers and back to a
// public redirect URI, so it must be tamper-evident: it carries the id of
// the user who initiated the connect flow, HMAC-signed with the session
// secret, so /slack/callback knows which user to attach the integration to
// without trusting an unsigned value from the query string.
function signState(userId: string): string {
  const signature = crypto.createHmac("sha256", env.sessionSecret).update(userId).digest("hex");
  return `${userId}.${signature}`;
}

function verifyState(state: string): string | null {
  const [userId, signature] = state.split(".");
  if (!userId || !signature) return null;

  const expected = crypto.createHmac("sha256", env.sessionSecret).update(userId).digest("hex");
  const signatureBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);
  if (signatureBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(signatureBuf, expectedBuf)) {
    return null;
  }
  return userId;
}

slackRouter.get("/connect", requireAuth, (req, res) => {
  if (!env.slackClientId) {
    res.status(501).json({ error: "Slack OAuth is not configured on this server" });
    return;
  }

  const state = signState(req.user!.id);
  const url = new URL("https://slack.com/oauth/v2/authorize");
  url.searchParams.set("client_id", env.slackClientId);
  url.searchParams.set("scope", "incoming-webhook");
  url.searchParams.set("redirect_uri", env.slackRedirectUri);
  url.searchParams.set("state", state);

  res.redirect(url.toString());
});

slackRouter.get("/callback", async (req, res) => {
  try {
    const code = req.query.code as string | undefined;
    const state = req.query.state as string | undefined;

    if (!code || !state) {
      res.redirect(`${env.frontendUrl}/dashboard?slack=error`);
      return;
    }

    const userId = verifyState(state);
    if (!userId) {
      res.status(400).json({ error: "Invalid or tampered state parameter" });
      return;
    }

    if (!env.slackClientId || !env.slackClientSecret) {
      res.status(501).json({ error: "Slack OAuth is not configured on this server" });
      return;
    }

    const tokenResponse = await fetch("https://slack.com/api/oauth.v2.access", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env.slackClientId,
        client_secret: env.slackClientSecret,
        code,
        redirect_uri: env.slackRedirectUri,
      }),
    });

    const data = (await tokenResponse.json()) as {
      ok: boolean;
      error?: string;
      access_token?: string;
      team?: { name?: string };
      incoming_webhook?: { url?: string };
    };

    if (!data.ok) {
      console.error("[slack] oauth.v2.access failed:", data.error);
      res.redirect(`${env.frontendUrl}/dashboard?slack=error`);
      return;
    }

    await upsertSlackIntegrationForUser({
      user_id: userId,
      access_token: data.access_token ?? null,
      webhook_url: data.incoming_webhook?.url ?? null,
      team_name: data.team?.name ?? null,
    });

    res.redirect(`${env.frontendUrl}/dashboard?slack=connected`);
  } catch (err) {
    console.error("[slack] callback failed:", err);
    res.redirect(`${env.frontendUrl}/dashboard?slack=error`);
  }
});

slackRouter.get("/status", requireAuth, async (req, res) => {
  const integration = await getSlackIntegrationByUserId(req.user!.id);
  res.json({
    connected: !!integration?.connected,
    teamName: integration?.team_name ?? null,
  });
});

slackRouter.post("/disconnect", requireAuth, async (req, res) => {
  await setSlackIntegrationConnected(req.user!.id, false);
  res.json({ ok: true });
});
