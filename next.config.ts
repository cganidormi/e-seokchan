import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Test: Webhook connection verification (Final)
  /* config options here */
  /* config options here */
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
