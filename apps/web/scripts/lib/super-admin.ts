import bcrypt from "bcryptjs";
import type { PrismaClient } from "@prisma/client";
import { emailSchema, passwordSchema } from "@sukkot/shared";

/** Create a super administrator, or promote an existing account and set its password. */
export async function upsertSuperAdmin(db: PrismaClient, input: { email: string; name: string; password: string; via: string }) {
  const email = emailSchema.parse(input.email);
  passwordSchema.parse(input.password);
  const hash = await bcrypt.hash(input.password, 12);
  const user = await db.user.upsert({
    where: { email },
    create: { email, passwordHash: hash, emailVerifiedAt: new Date(), profile: { create: { fullName: input.name.trim() || "Administrator" } } },
    update: { passwordHash: hash, status: "ACTIVE" },
  });
  for (const role of ["USER", "SUPER_ADMIN"] as const) {
    await db.userRoleAssignment.upsert({ where: { userId_role: { userId: user.id, role } }, create: { userId: user.id, role }, update: {} });
  }
  await db.auditLog.create({ data: { action: "admin.bootstrap", targetType: "User", targetId: user.id, metadata: { via: input.via } } });
  return email;
}
