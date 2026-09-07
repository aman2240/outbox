import { queryOne } from "./client";
import { SlackIntegration } from "../types";

export interface UpsertSlackIntegrationInput {
  user_id: string;
  access_token?: string | null;
  webhook_url: string | null;
  team_name?: string | null;
}

export async function upsertSlackIntegrationForUser(input: UpsertSlackIntegrationInput): Promise<SlackIntegration> {
  const row = await queryOne<SlackIntegration>(
    `INSERT INTO slack_integrations (user_id, access_token, webhook_url, team_name, connected)
     VALUES ($1, $2, $3, $4, true)
     ON CONFLICT (user_id) DO UPDATE SET
       access_token = EXCLUDED.access_token,
       webhook_url = EXCLUDED.webhook_url,
       team_name = EXCLUDED.team_name,
       connected = true
     RETURNING *`,
    [input.user_id, input.access_token ?? null, input.webhook_url, input.team_name ?? null]
  );
  if (!row) throw new Error("Failed to upsert slack integration");
  return row;
}

export async function getSlackIntegrationByUserId(userId: string): Promise<SlackIntegration | null> {
  return queryOne<SlackIntegration>("SELECT * FROM slack_integrations WHERE user_id = $1", [userId]);
}

export async function setSlackIntegrationConnected(userId: string, connected: boolean): Promise<void> {
  await queryOne("UPDATE slack_integrations SET connected = $2 WHERE user_id = $1 RETURNING id", [userId, connected]);
}
