import { Client } from "@elastic/elasticsearch";
import { env } from "./env";

// maxRetries: 0 and a short requestTimeout are deliberate: since ES is
// search-only here (see services/elasticsearchIndex.ts) and every call site
// already treats a failure as "degrade gracefully," we want a down/
// unreachable cluster to fail fast and consistently everywhere — not have
// reads (search) retry with backoff while writes (index) fail instantly,
// which otherwise makes /api/emails/search visibly slow (~7s) whenever ES
// is unavailable.
export const esClient = new Client({
  node: env.elasticsearchUrl,
  maxRetries: 0,
  requestTimeout: 3000,
});

export async function checkElasticsearchConnection(): Promise<boolean> {
  try {
    await esClient.ping();
    return true;
  } catch (err) {
    console.error("[elasticsearch] connection check failed:", (err as Error).message);
    return false;
  }
}
