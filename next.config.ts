import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep Next.js server capabilities enabled (App Router + API routes).
  // Phase 1 UI depends on /api/* contract, so static export is not compatible.
  images: {
    unoptimized: true,
  },
  reactStrictMode: true,

  reactCompiler: true,
};

export default nextConfig;
