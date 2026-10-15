import "server-only";
import { randomUUID } from "node:crypto";
import type { PropertyVideo } from "@prisma/client";
import { db } from "../db";
import { AppError, forbidden, notFound } from "../errors";
import type { Actor } from "../auth/session";
import { assertPermission } from "../auth/actor";
import { audit } from "../audit";
import { publicFileUrl, storage } from "../storage";
import { convertVideo, MAX_VIDEO_BYTES, sniffVideo } from "../video";

/** A conversion that has not finished after this long was cut off (the server restarted). */
const STALE_AFTER_MS = 30 * 60_000;

/** Conversions run one at a time so a small server is never asked to convert two videos at once. */
let queue: Promise<unknown> = Promise.resolve();
const running = new Map<string, Promise<void>>();

/** Wait for a listing's conversion to finish (used by tests and scripts). */
export function videoJob(propertyId: string) {
  return running.get(propertyId) ?? Promise.resolve();
}

export function videoDto(v: PropertyVideo | null) {
  if (!v) return null;
  const ready = v.status === "READY";
  return {
    status: v.status,
    url: ready ? publicFileUrl(`${v.storageKey}.mp4`) : null,
    posterUrl: ready ? publicFileUrl(`${v.storageKey}-poster.webp`) : null,
    durationSec: v.durationSec,
    width: v.width,
    height: v.height,
    error: v.error,
  };
}
export type VideoDTO = NonNullable<ReturnType<typeof videoDto>>;

async function loadOwn(actor: Actor, propertyId: string) {
  const p = await db.property.findUnique({ where: { id: propertyId }, select: { id: true, listerId: true, ownerId: true } });
  if (!p) throw notFound("Listing");
  if (actor.id !== p.listerId && actor.id !== p.ownerId) throw forbidden("You can only manage your own listings");
  return p;
}

async function deleteFiles(storageKey: string) {
  await Promise.all([`${storageKey}.mp4`, `${storageKey}-poster.webp`].map((k) => storage().delete(k, "public").catch(() => undefined)));
}

/** The lister's view of their listing video. A conversion cut off by a restart is reported as failed. */
export async function getOwnListingVideo(actorIn: Actor | null, propertyId: string) {
  const actor = assertPermission(actorIn, "listing:manage_own");
  await loadOwn(actor, propertyId);
  return getListingVideo(propertyId);
}

export async function getListingVideo(propertyId: string) {
  const v = await db.propertyVideo.findUnique({ where: { propertyId } });
  if (v?.status === "PROCESSING" && !running.has(propertyId) && Date.now() - v.updatedAt.getTime() > STALE_AFTER_MS) {
    return db.propertyVideo.update({ where: { id: v.id }, data: { status: "FAILED", error: "Converting the video was interrupted. Please upload it again." } });
  }
  return v;
}

/**
 * Add or replace a listing's short video. The file is checked and saved straight away; converting it
 * runs in the background and the video shows on the listing once it is ready.
 */
export async function uploadListingVideo(actorIn: Actor | null, propertyId: string, file: File) {
  const actor = assertPermission(actorIn, "listing:manage_own");
  await loadOwn(actor, propertyId);
  if (file.size > MAX_VIDEO_BYTES) throw new AppError("VALIDATION", `Videos can be up to ${MAX_VIDEO_BYTES / 1024 / 1024} MB`);
  const buf = Buffer.from(await file.arrayBuffer());
  if (!sniffVideo(buf)) throw new AppError("VALIDATION", "Upload an MP4, MOV or WebM video");

  const previous = await db.propertyVideo.findUnique({ where: { propertyId } });
  const storageKey = `videos/${propertyId}/${randomUUID()}`;
  const video = await db.propertyVideo.upsert({
    where: { propertyId },
    create: { propertyId, storageKey },
    update: { storageKey, status: "PROCESSING", error: null, durationSec: null, width: null, height: null, sizeBytes: null },
  });
  if (previous) await deleteFiles(previous.storageKey);
  await audit({ actorId: actor.id, action: "listing.video_upload", targetType: "Property", targetId: propertyId, metadata: { bytes: buf.length } });

  const job = queue.then(async () => {
    try {
      const out = await convertVideo(buf);
      await storage().put(`${storageKey}.mp4`, out.mp4, "video/mp4", "public");
      await storage().put(`${storageKey}-poster.webp`, out.poster, "image/webp", "public");
      // Only mark it ready if it was not replaced or removed while converting.
      const done = await db.propertyVideo.updateMany({
        where: { propertyId, storageKey },
        data: { status: "READY", durationSec: out.durationSec, width: out.width, height: out.height, sizeBytes: out.mp4.length },
      });
      if (done.count === 0) await deleteFiles(storageKey);
    } catch (e) {
      const error = e instanceof AppError ? e.message : "We could not convert that video. Try again, or a different file.";
      if (!(e instanceof AppError)) console.error("[video] conversion failed", e);
      await db.propertyVideo.updateMany({ where: { propertyId, storageKey }, data: { status: "FAILED", error } }).catch(() => undefined);
    }
  });
  queue = job;
  const tracked = job.finally(() => {
    if (running.get(propertyId) === tracked) running.delete(propertyId);
  });
  running.set(propertyId, tracked);
  return videoDto(video)!;
}

export async function removeListingVideo(actorIn: Actor | null, propertyId: string) {
  const actor = assertPermission(actorIn, "listing:manage_own");
  await loadOwn(actor, propertyId);
  const v = await db.propertyVideo.findUnique({ where: { propertyId } });
  if (!v) return;
  await db.propertyVideo.delete({ where: { id: v.id } });
  await deleteFiles(v.storageKey);
  await audit({ actorId: actor.id, action: "listing.video_remove", targetType: "Property", targetId: propertyId });
}
