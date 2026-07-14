import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["95f3-118-148-173-123.ngrok-free.app"],
  /* config options here */
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  // Optimizaciones adicionales para SEO y performance
  compress: true,
  poweredByHeader: false,
  generateEtags: true,
  reactStrictMode: true,
};

export default nextConfig;
