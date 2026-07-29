import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["pg"],
  images: { unoptimized: true },
  devIndicators: false,
};

export default nextConfig;
