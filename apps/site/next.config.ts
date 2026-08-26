import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: process.env.STATIC_EXPORT === "1" ? "export" : undefined,
  assetPrefix: process.env.PAGES_BASE_PATH || undefined,
};

export default nextConfig;
