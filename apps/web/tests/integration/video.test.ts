import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import ffmpegStatic from "ffmpeg-static";
import { db } from "@/server/db";
import { storage } from "@/server/storage";
import { getPropertyDetail } from "@/server/services/properties";
import { removeListingVideo, uploadListingVideo, videoJob } from "@/server/services/video";
import { GET as servePublicFile } from "@/app/api/v1/files/public/[...key]/route";
import { makeUser, publishedListing } from "../support/factory";

const ffmpeg = process.env.FFMPEG_PATH || ffmpegStatic || "ffmpeg";

/** Make a test clip with ffmpeg's built-in test pattern. */
function clip(name: string, args: string[]) {
  const out = path.join(mkdtempSync(path.join(os.tmpdir(), "clip-")), name);
  execFileSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", ...args, out]);
  const buf = readFileSync(out);
  return new File([new Uint8Array(buf)], name, { type: name.endsWith(".mov") ? "video/quicktime" : "video/mp4" });
}

function report(file: string) {
  try {
    execFileSync(ffmpeg, ["-hide_banner", "-i", file], { stdio: "pipe" });
  } catch (e) {
    return String((e as { stderr: Buffer }).stderr);
  }
  return "";
}

describe("listing videos", () => {
  it("converts a phone video to a small MP4 without its location, and shows it on the listing", async () => {
    const owner = await makeUser(["OWNER"]);
    const listing = await publishedListing(owner, await makeUser(["MODERATOR"]));
    // A portrait phone-style recording: 1080x1920, 4 seconds, with sound and a GPS location tag.
    const file = clip("IMG_0420.mov", [
      "-f", "lavfi", "-i", "testsrc2=size=1080x1920:rate=30:duration=4",
      "-f", "lavfi", "-i", "sine=frequency=440:duration=4",
      "-c:v", "libx264", "-preset", "ultrafast", "-crf", "18", "-c:a", "aac",
      "-metadata", "location=+08.4840-013.2299/", "-metadata", "com.apple.quicktime.location.ISO6709=+08.4840-013.2299/",
    ]);

    const first = await uploadListingVideo(owner, listing.id, file);
    expect(first.status).toBe("PROCESSING");
    expect((await getPropertyDetail(listing.slug, null))!.video).toBeNull();
    await videoJob(listing.id);

    const v = await db.propertyVideo.findUniqueOrThrow({ where: { propertyId: listing.id } });
    expect(v.status).toBe("READY");
    expect(v.durationSec).toBe(4);
    expect([v.width, v.height]).toEqual([720, 1280]);
    expect(v.sizeBytes!).toBeLessThan(file.size);

    const mp4 = await storage().get(`${v.storageKey}.mp4`, "public");
    const tmp = path.join(mkdtempSync(path.join(os.tmpdir(), "check-")), "out.mp4");
    writeFileSync(tmp, mp4!.body);
    const info = report(tmp);
    expect(info).toMatch(/Video: h264/);
    expect(info).toMatch(/Audio: aac/);
    expect(info).not.toMatch(/location/i);
    expect(await storage().get(`${v.storageKey}-poster.webp`, "public")).not.toBeNull();

    const detail = await getPropertyDetail(listing.slug, null);
    expect(detail!.video?.url).toContain(`${v.storageKey}.mp4`);

    // Browsers fetch videos in byte ranges.
    const key = `${v.storageKey}.mp4`.split("/");
    const partial = await servePublicFile(new Request("http://x/", { headers: { range: "bytes=0-99" } }), { params: Promise.resolve({ key }) });
    expect(partial.status).toBe(206);
    expect(partial.headers.get("content-range")).toBe(`bytes 0-99/${mp4!.body.length}`);
    expect((await partial.arrayBuffer()).byteLength).toBe(100);

    // Someone else cannot change it; the lister can remove it, files and all.
    await expect(removeListingVideo(await makeUser(["OWNER"]), listing.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await removeListingVideo(owner, listing.id);
    expect(await db.propertyVideo.findUnique({ where: { propertyId: listing.id } })).toBeNull();
    expect(await storage().get(`${v.storageKey}.mp4`, "public")).toBeNull();
  }, 120_000);

  it("turns an iPhone-style HEVC video recorded sideways into an upright MP4", async () => {
    const owner = await makeUser(["OWNER"]);
    const listing = await publishedListing(owner, await makeUser(["MODERATOR"]));
    const hevc = clip("hevc.mov", ["-f", "lavfi", "-i", "testsrc2=size=1920x1080:rate=30:duration=2", "-c:v", "libx265", "-tag:v", "hvc1", "-preset", "ultrafast", "-x265-params", "log-level=error"]);
    // Phones store the picture sideways and flag the rotation, as -display_rotation does here.
    const dir = mkdtempSync(path.join(os.tmpdir(), "rot-"));
    writeFileSync(path.join(dir, "in.mov"), Buffer.from(await hevc.arrayBuffer()));
    execFileSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", "-display_rotation", "90", "-i", path.join(dir, "in.mov"), "-c", "copy", path.join(dir, "rot.mov")]);
    const rotated = new File([new Uint8Array(readFileSync(path.join(dir, "rot.mov")))], "IMG_0001.MOV", { type: "video/quicktime" });

    await uploadListingVideo(owner, listing.id, rotated);
    await videoJob(listing.id);
    const v = await db.propertyVideo.findUniqueOrThrow({ where: { propertyId: listing.id } });
    expect(v.status).toBe("READY");
    expect([v.width, v.height]).toEqual([720, 1280]);
  }, 120_000);

  it("refuses files that are not videos, and reports videos over a minute as failed", async () => {
    const owner = await makeUser(["OWNER"]);
    const listing = await publishedListing(owner, await makeUser(["MODERATOR"]));
    await expect(uploadListingVideo(owner, listing.id, new File([new Uint8Array(Buffer.from("not a video at all, just text"))], "x.mp4"))).rejects.toMatchObject({ code: "VALIDATION" });

    const long = clip("long.mp4", ["-f", "lavfi", "-i", "testsrc2=size=160x120:rate=5:duration=65", "-c:v", "libx264", "-preset", "ultrafast"]);
    await uploadListingVideo(owner, listing.id, long);
    await videoJob(listing.id);
    const v = await db.propertyVideo.findUniqueOrThrow({ where: { propertyId: listing.id } });
    expect(v.status).toBe("FAILED");
    expect(v.error).toMatch(/up to 60 seconds/);
  }, 120_000);
});
