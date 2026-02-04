import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Test: Webhook connection verification (Final)
  /* config options here */
  /* config options here */
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  generateBuildId: async () => {
    // This forces a new build ID every time, invalidating the cache
    return `build-${Date.now()}`
  },
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
