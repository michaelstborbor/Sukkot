import "server-only";
import { env } from "./env";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

/**
 * Email delivery behind a tiny interface. "console" logs (development); "resend" uses the
 * Resend HTTP API. Failures are logged and never break the user-facing action.
 */
export async function sendEmail(msg: EmailMessage): Promise<boolean> {
  try {
    if (env.emailDriver === "resend") {
      const key = process.env.RESEND_API_KEY;
      if (!key) throw new Error("RESEND_API_KEY is not set");
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
        body: JSON.stringify({ from: env.emailFrom, to: [msg.to], subject: msg.subject, text: msg.text }),
      });
      if (!res.ok) throw new Error(`Resend responded ${res.status}`);
      return true;
    }
    if (process.env.NODE_ENV !== "test") {
      console.info(`[email:console] to=${msg.to} subject="${msg.subject}"\n${msg.text}`);
    }
    return true;
  } catch (err) {
    console.error("[email] delivery failed", err);
    return false;
  }
}
