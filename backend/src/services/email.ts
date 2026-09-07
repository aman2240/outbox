import nodemailer, { Transporter } from "nodemailer";
import { Sender } from "../types";

const transporterCache = new Map<string, Transporter>();

/**
 * Creates (and caches, keyed by sender.id) a nodemailer transporter against
 * Ethereal's SMTP host for a given sender identity. We cache rather than
 * recreate per-send since building a transporter/connection pool per email
 * would be wasteful under any real send volume.
 */
export function getTransporterForSender(sender: Pick<Sender, "id" | "smtp_user" | "smtp_pass">): Transporter {
  const cached = transporterCache.get(sender.id);
  if (cached) return cached;

  const transporter = nodemailer.createTransport({
    host: "smtp.ethereal.email",
    port: 587,
    secure: false,
    auth: {
      user: sender.smtp_user,
      pass: sender.smtp_pass,
    },
    // Bound how long a single send can hang on a bad network path — a stuck
    // TCP handshake shouldn't tie up a worker slot indefinitely.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 10_000,
  });

  transporterCache.set(sender.id, transporter);
  return transporter;
}

export interface SendEmailResult {
  messageId: string;
  previewUrl: string | null;
}

export async function sendEmail(
  sender: Pick<Sender, "id" | "smtp_user" | "smtp_pass" | "email" | "name">,
  recipient: string,
  subject: string,
  body: string
): Promise<SendEmailResult> {
  const transporter = getTransporterForSender(sender);

  const info = await transporter.sendMail({
    from: `"${sender.name}" <${sender.email}>`,
    to: recipient,
    subject,
    text: body,
  });

  const previewUrl = nodemailer.getTestMessageUrl(info);

  return {
    messageId: info.messageId,
    previewUrl: previewUrl || null,
  };
}
