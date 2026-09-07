import { Client } from "@elastic/elasticsearch";
import { env } from "./env";

export const esClient = new Client({ node: env.elasticsearchUrl });

export async function checkElasticsearchConnection(): Promise<boolean> {
  try {
    await esClient.ping();
    return true;
  } catch (err) {
    console.error("[elasticsearch] connection check failed:", (err as Error).message);
    return false;
  }
}
