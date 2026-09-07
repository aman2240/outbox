import { esClient } from "../config/elasticsearch";
import { EmailJob } from "../types";

export const EMAILS_INDEX = "emails";

export async function ensureEmailsIndexExists(): Promise<void> {
  try {
    const exists = await esClient.indices.exists({ index: EMAILS_INDEX });
    if (exists) return;

    await esClient.indices.create({
      index: EMAILS_INDEX,
      mappings: {
        properties: {
          recipient: { type: "text", fields: { keyword: { type: "keyword" } } },
          subject: { type: "text" },
          body: { type: "text" },
          status: { type: "keyword" },
          sender_id: { type: "keyword" },
          scheduled_at: { type: "date" },
          sent_at: { type: "date" },
        },
      },
    });
    console.log(`[elasticsearch] created "${EMAILS_INDEX}" index`);
  } catch (err) {
    // Elasticsearch is search-only in this system — Postgres is always the
    // source of truth — so failing to set up the index must not stop boot.
    console.error("[elasticsearch] failed to ensure index exists (search will be degraded):", (err as Error).message);
  }
}

/**
 * Upserts a document into the emails index using the email_jobs row's own
 * id as the ES document id, so re-indexing the same row (e.g. on every
 * status transition) is naturally idempotent — no separate "does this doc
 * already exist" check needed.
 */
export async function indexEmailJob(row: EmailJob): Promise<void> {
  try {
    await esClient.index({
      index: EMAILS_INDEX,
      id: row.id,
      document: {
        recipient: row.recipient,
        subject: row.subject,
        body: row.body,
        status: row.status,
        sender_id: row.sender_id,
        scheduled_at: row.scheduled_at,
        sent_at: row.sent_at,
      },
    });
  } catch (err) {
    // A search-index write failure must never break scheduling/sending.
    console.error(`[elasticsearch] failed to index email_jobs row ${row.id} (non-fatal):`, (err as Error).message);
  }
}

export async function searchEmailIds(q: string, status?: string): Promise<string[]> {
  try {
    const result = await esClient.search({
      index: EMAILS_INDEX,
      size: 100,
      query: {
        bool: {
          must: q ? [{ multi_match: { query: q, fields: ["subject", "body", "recipient"] } }] : [{ match_all: {} }],
          filter: status ? [{ term: { status } }] : [],
        },
      },
    });
    return result.hits.hits.map((hit) => hit._id as string);
  } catch (err) {
    console.error("[elasticsearch] search failed:", (err as Error).message);
    return [];
  }
}
