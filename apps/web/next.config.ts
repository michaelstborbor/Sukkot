import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

// Content Security Policy: self-hosted scripts and fonts only; images from our storage and
// the optional public CDN configured in STORAGE_PUBLIC_BASE_URL.
const cdn = process.env.STORAGE_PUBLIC_BASE_URL ? new URL(process.env.STORAGE_PUBLIC_BASE_URL).origin : "";
const csp = [
  "default-src 'self'",
  `img-src 'self' data: blob: ${cdn}`.trim(),
  `media-src 'self' blob: ${cdn}`.trim(),
  "style-src 'self' 'unsafe-inline'",
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-src https://www.youtube-nocookie.com https://player.vimeo.com https://my.matterport.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self), payment=()" },
  ...(isProd ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }] : []),
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ["@sukkot/shared"],
  serverExternalPackages: ["sharp", "bcryptjs", "ffmpeg-static"],
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [360, 480, 640, 828, 1080, 1280, 1600],
    remotePatterns: cdn ? [{ protocol: "https", hostname: new URL(cdn).hostname }] : [],
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts", "framer-motion"],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
