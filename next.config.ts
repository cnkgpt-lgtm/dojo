import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Upload foto selfie/bukti (Phase 3+) akan disimpan di public/uploads
  images: { remotePatterns: [] },
};

export default nextConfig;
