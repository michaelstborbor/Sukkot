/**
 * Create (or promote) a super administrator. Run once per environment:
 *   ADMIN_EMAIL=you@example.sl ADMIN_NAME="Your Name" pnpm --filter @sukkot/web admin:create
 * The password is read from ADMIN_PASSWORD, or prompted for. It is never printed or stored in plain text.
 */
import { createInterface } from "node:readline/promises";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { emailSchema, passwordSchema } from "@sukkot/shared";

async function main() {
  const db = new PrismaClient();
  try {
    const email = emailSchema.parse(process.env.ADMIN_EMAIL ?? "");
    const name = (process.env.ADMIN_NAME ?? "Administrator").trim();
    let password = process.env.ADMIN_PASSWORD;
    if (!password) {
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      password = await rl.question("Password (min 10 characters, letters and numbers): ");
      rl.close();
    }
    passwordSchema.parse(password);
    const hash = await bcrypt.hash(password, 12);
    const user = await db.user.upsert({
      where: { email },
      create: { email, passwordHash: hash, emailVerifiedAt: new Date(), profile: { create: { fullName: name } } },
      update: { passwordHash: hash, status: "ACTIVE" },
    });
    for (const role of ["USER", "SUPER_ADMIN"] as const) {
      await db.userRoleAssignment.upsert({ where: { userId_role: { userId: user.id, role } }, create: { userId: user.id, role }, update: {} });
    }
    await db.auditLog.create({ data: { action: "admin.bootstrap", targetType: "User", targetId: user.id, metadata: { via: "scripts/create-admin.ts" } } });
    console.log(`Super administrator ready: ${email}`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
