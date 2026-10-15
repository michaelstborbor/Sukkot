/**
 * Create (or promote) a super administrator. Run once per environment:
 *   ADMIN_EMAIL=you@example.sl ADMIN_NAME="Your Name" pnpm --filter @sukkot/web admin:create
 * The password is read from ADMIN_PASSWORD, or prompted for. It is never printed or stored in plain text.
 */
import { createInterface } from "node:readline/promises";
import { PrismaClient } from "@prisma/client";
import { upsertSuperAdmin } from "./lib/super-admin";

async function main() {
  const db = new PrismaClient();
  try {
    let password = process.env.ADMIN_PASSWORD;
    if (!password) {
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      password = await rl.question("Password (min 10 characters, letters and numbers): ");
      rl.close();
    }
    const email = await upsertSuperAdmin(db, { email: process.env.ADMIN_EMAIL ?? "", name: process.env.ADMIN_NAME ?? "Administrator", password, via: "scripts/create-admin.ts" });
    console.log(`Super administrator ready: ${email}`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
