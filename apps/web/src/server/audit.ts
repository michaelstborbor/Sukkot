import "server-only";
import type { Prisma } from "@prisma/client";
import { db, type Tx } from "./db";

/** Append an audit record. Pass a transaction client to make it atomic with the change it records. */
export async function audit(
  entry: {
    actorId: string | null;
    action: string;
    targetType?: string;
    targetId?: string;
    metadata?: Prisma.InputJsonValue;
    ipHash?: string | null;
  },
  tx: Tx | typeof db = db,
) {
  await tx.auditLog.create({
    data: {
      actorId: entry.actorId,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      metadata: entry.metadata,
      ipHash: entry.ipHash ?? null,
    },
  });
}
