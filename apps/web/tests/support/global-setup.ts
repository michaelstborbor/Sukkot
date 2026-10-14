import { execSync } from "node:child_process";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

/**
 * Bring the test database up to date without destroying anything: apply pending migrations, then
 * load reference data and the labelled demo dataset once if the database is empty. Tests create
 * their own uniquely named records, so repeated runs do not interfere with each other.
 */
export default async function setup() {
  const url = process.env.TEST_DATABASE_URL ?? "postgresql://postgres@localhost:5432/sukkot_test";
  if (!/test/.test(url)) throw new Error(`Refusing to use a database that does not look like a test database: ${url}`);
  const cwd = path.resolve(__dirname, "../..");
  const env = { ...process.env, DATABASE_URL: url, NODE_ENV: "test" as const, STORAGE_LOCAL_DIR: path.join(cwd, ".test-storage"), PRISMA_HIDE_UPDATE_MESSAGE: "1" };
  execSync("npx prisma migrate deploy", { cwd, env, stdio: "pipe" });
  const db = new PrismaClient({ datasources: { db: { url } } });
  try {
    if ((await db.location.count()) === 0) execSync("npx tsx prisma/seed.ts", { cwd, env, stdio: "pipe" });
  } finally {
    await db.$disconnect();
  }
}
