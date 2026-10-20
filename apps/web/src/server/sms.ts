import "server-only";
import { env } from "./env";

export interface SmsMessage {
  /** E.164, e.g. +23276123456. */
  to: string;
  text: string;
}

/**
 * Text messages behind a tiny interface, like `sendEmail`. "console" logs (development and demo
 * sites); "twilio" uses Twilio's Messages API with TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and either
 * TWILIO_MESSAGING_SERVICE_SID or TWILIO_FROM. Failures are logged and reported as false.
 */
export async function sendSms(msg: SmsMessage): Promise<boolean> {
  try {
    if (env.smsDriver === "twilio") {
      const sid = process.env.TWILIO_ACCOUNT_SID;
      const token = process.env.TWILIO_AUTH_TOKEN;
      const service = process.env.TWILIO_MESSAGING_SERVICE_SID;
      const from = process.env.TWILIO_FROM;
      if (!sid || !token || (!service && !from)) throw new Error("Twilio is not fully configured");
      const body = new URLSearchParams({ To: msg.to, Body: msg.text, ...(service ? { MessagingServiceSid: service } : { From: from! }) });
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
        method: "POST",
        headers: { authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`, "content-type": "application/x-www-form-urlencoded" },
        body,
      });
      if (!res.ok) throw new Error(`Twilio responded ${res.status}`);
      return true;
    }
    if (process.env.NODE_ENV !== "test") console.info(`[sms:console] to=${msg.to}\n${msg.text}`);
    return true;
  } catch (err) {
    console.error("[sms] delivery failed", err);
    return false;
  }
}
