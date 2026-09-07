import { Router } from "express";
import { listSenders } from "../db/senders";
import { requireAuth } from "../middleware/requireAuth";

export const sendersRouter = Router();

sendersRouter.get("/", requireAuth, async (_req, res) => {
  try {
    const senders = await listSenders();
    res.json({ senders });
  } catch (err) {
    console.error("[senders] list failed:", err);
    res.status(500).json({ error: "Failed to list senders" });
  }
});
