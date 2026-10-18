import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  devIndicators: false,
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // Allow serving avatar assets
  images: {
    unoptimized: true,
  },
  async rewrites() {
    // If BACKEND_URL is explicitly provided during build, use high-performance Next.js rewrite.
    // If not provided during build, app/api/v1/[...path]/route.ts handles runtime proxying
    // reading BACKEND_URL dynamically on Cloud Run.
    const backendUrl =
      process.env.BACKEND_URL ||
      process.env.NEXT_PUBLIC_BACKEND_URL;
    if (backendUrl) {
      return [
        {
          source: '/api/v1/:path*',
          destination: `${backendUrl.replace(/\/$/, '')}/api/v1/:path*`,
        },
      ];
    }
    return [];
  },

};

export default nextConfig;
