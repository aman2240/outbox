/**
 * One-off setup script: creates two disposable Ethereal SMTP test accounts
 * and inserts them into the `senders` table so there are real, working
 * senders to schedule emails from. Run manually:
 *
 *   npm run create-ethereal-senders
 *
 * Requires outbound network access to Ethereal's account-creation API
 * (api.nodemailer.com) — this is separate from actually sending mail later,
 * which talks to smtp.ethereal.email on port 587.
 */
import nodemailer from "nodemailer";
import { pool } from "../config/postgres";
import { createSender } from "../db/senders";

async function main() {
  console.log("Creating 2 Ethereal test accounts...\n");

  for (let i = 1; i <= 2; i++) {
    const account = await nodemailer.createTestAccount();

    console.log(`Sender ${i}:`);
    console.log(`  user: ${account.user}`);
    console.log(`  pass: ${account.pass}`);
    console.log(`  smtp: ${account.smtp.host}:${account.smtp.port}`);

    const sender = await createSender({
      name: `Ethereal Sender ${i}`,
      email: account.user,
      smtp_user: account.user,
      smtp_pass: account.pass,
    });

    console.log(`  inserted as senders.id = ${sender.id}\n`);
  }

  console.log("Done. These senders are now selectable in the app.");
  await pool.end();
}

main().catch((err) => {
  console.error("Failed to create Ethereal senders:", err);
  process.exit(1);
});
