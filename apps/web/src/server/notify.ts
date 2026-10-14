import "server-only";
import { db, type Tx } from "./db";
import { sendEmail } from "./email";
import { env } from "./env";

export interface NotifyInput {
  userId: string;
  type: string;
  title: string;
  body: string;
  link?: string;
  email?: boolean;
}

/** Create in-app notifications (inside the caller's transaction) and optionally email them afterwards. */
export async function notify(items: NotifyInput[], tx: Tx | typeof db = db) {
  if (!items.length) return;
  await tx.notification.createMany({
    data: items.map((n) => ({ userId: n.userId, type: n.type, title: n.title, body: n.body, link: n.link ?? null })),
  });
  const toEmail = items.filter((n) => n.email);
  if (toEmail.length) {
    // Fire-and-forget after the response path; email failures must not roll back the action.
    queueMicrotask(async () => {
      const users = await db.user.findMany({ where: { id: { in: toEmail.map((n) => n.userId) } }, select: { id: true, email: true, isDemo: true } });
      for (const n of toEmail) {
        const u = users.find((x) => x.id === n.userId);
        if (!u || u.isDemo) continue;
        await sendEmail({ to: u.email, subject: n.title, text: `${n.body}\n\n${n.link ? env.appUrl + n.link : env.appUrl}` });
      }
    });
  }
}
