import { Router } from "express";
import { query } from "../db/client";
import { searchEmailIds } from "../services/elasticsearchIndex";
import { EmailJob } from "../types";

export const emailsRouter = Router();

// Elasticsearch is used for search only — it decides *which* rows match,
// Postgres remains the source of truth for the actual row data. We fetch
// full rows by the matched ids rather than trusting the ES documents to
// carry everything the frontend needs (keeps ES's schema free to diverge
// from Postgres's without the API breaking).
emailsRouter.get("/search", async (req, res) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q : "";
    const status = typeof req.query.status === "string" ? req.query.status : undefined;

    const ids = await searchEmailIds(q, status);
    if (ids.length === 0) {
      res.json({ results: [] });
      return;
    }

    const rows = await query<EmailJob>("SELECT * FROM email_jobs WHERE id = ANY($1)", [ids]);
    const byId = new Map(rows.map((row) => [row.id, row]));
    const ordered = ids.map((id) => byId.get(id)).filter((row): row is EmailJob => Boolean(row));

    res.json({ results: ordered });
  } catch (err) {
    console.error("[emails] search failed:", err);
    res.status(500).json({ error: "Search failed" });
  }
});
