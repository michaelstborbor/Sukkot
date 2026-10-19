-- Uploaded files kept in Postgres for hosts whose disk is wiped on restart (STORAGE_DRIVER=database).
-- CreateTable
CREATE TABLE "stored_files" (
    "visibility" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "body" BYTEA NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stored_files_pkey" PRIMARY KEY ("visibility","key")
);

