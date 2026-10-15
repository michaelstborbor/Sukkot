import "server-only";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import ffmpegStatic from "ffmpeg-static";
import sharp from "sharp";
import { AppError } from "./errors";

export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
export const MAX_VIDEO_SECONDS = 60;
/** The longer side of the converted video. 1280 px (720p) looks sharp on phones and laptops. */
export const VIDEO_LONG_SIDE = 1280;

const FFMPEG = process.env.FFMPEG_PATH || ffmpegStatic || "ffmpeg";

/** MP4 and MOV (phones) share the ISO media format; WebM is EBML. Anything else is refused. */
export function sniffVideo(buf: Buffer): "iso" | "webm" | null {
  if (buf.length < 12) return null;
  if (buf.subarray(4, 8).toString("ascii") === "ftyp") return "iso";
  if (buf.readUInt32BE(0) === 0x1a45dfa3) return "webm";
  return null;
}

/** "Duration: 00:01:02.50" in ffmpeg's report, in seconds. */
export function parseDuration(report: string): number | null {
  const m = /Duration: (\d+):(\d{2}):(\d{2}(?:\.\d+)?)/.exec(report);
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : null;
}

function run(args: string[], timeoutMs: number): Promise<{ code: number | null; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(FFMPEG, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (d: Buffer) => {
      stderr = (stderr + d.toString()).slice(-20_000);
    });
    const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stderr });
    });
  });
}

/** Read a video's length without converting it. Throws a lister-friendly error when it is unusable. */
export async function probeVideo(file: string) {
  const { stderr } = await run(["-hide_banner", "-i", file], 60_000);
  const duration = parseDuration(stderr);
  if (duration === null || !/Stream #.*Video:/.test(stderr)) throw new AppError("VALIDATION", "We could not read that video. Try an MP4 or MOV file from your phone.");
  if (duration > MAX_VIDEO_SECONDS + 0.5) throw new AppError("VALIDATION", `Videos can be up to ${MAX_VIDEO_SECONDS} seconds long. This one is ${Math.round(duration)} seconds.`);
  return { durationSec: Math.max(1, Math.round(duration)) };
}

/**
 * Convert to a small MP4 that plays everywhere (H.264 + AAC, at most 1280 px on the long side,
 * starts playing before it has fully downloaded) and grab a still image for before it plays.
 * GPS location and every other metadata tag in the phone's file are dropped.
 */
export async function convertVideo(input: Buffer) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "sukkot-video-"));
  try {
    const src = path.join(dir, "in");
    const out = path.join(dir, "out.mp4");
    const still = path.join(dir, "poster.png");
    await writeFile(src, input);
    const { durationSec } = await probeVideo(src);

    // Even dimensions (H.264 needs them); the long side capped, never enlarged; phone rotation applied.
    const scale = `scale='if(gte(iw,ih),min(${VIDEO_LONG_SIDE},trunc(iw/2)*2),-2)':'if(gte(iw,ih),-2,min(${VIDEO_LONG_SIDE},trunc(ih/2)*2))'`;
    const conv = await run(
      [
        "-hide_banner", "-y", "-i", src,
        "-map", "0:v:0", "-map", "0:a:0?",
        "-vf", scale,
        // Two threads keep memory low on small servers.
        "-threads", "2",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "26", "-profile:v", "high", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "96k", "-ac", "2",
        "-map_metadata", "-1", "-map_chapters", "-1",
        "-movflags", "+faststart",
        "-t", String(MAX_VIDEO_SECONDS),
        out,
      ],
      20 * 60_000,
    );
    if (conv.code !== 0) throw new AppError("VALIDATION", "We could not convert that video. Try recording it again, or a different file.");

    const at = Math.min(1, durationSec / 2).toFixed(2);
    const grab = await run(["-hide_banner", "-y", "-ss", at, "-i", out, "-frames:v", "1", still], 60_000);
    if (grab.code !== 0) throw new AppError("VALIDATION", "We could not read a frame from that video.");

    const poster = sharp(await readFile(still));
    const meta = await poster.metadata();
    return {
      mp4: await readFile(out),
      poster: await poster.webp({ quality: 80 }).toBuffer(),
      durationSec,
      width: meta.width ?? null,
      height: meta.height ?? null,
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
