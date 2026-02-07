import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep your existing config
  serverExternalPackages: ["pdf-parse"],

  // Add this to fix the "Can't resolve 'canvas'" error
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default nextConfig;