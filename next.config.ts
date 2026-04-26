import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  // Strip console.* in production builds (keep error/warn for crash diagnosis
  // in the Android WebView). The dev server is unaffected. This shaves a few
  // KB off the bundle and silences the noisy [refreshData] / [dual-write]
  // logs that are only useful while debugging.
  compiler: {
    removeConsole:
      process.env.NODE_ENV === "production"
        ? { exclude: ["error", "warn"] }
        : false,
  },
};

export default nextConfig;
