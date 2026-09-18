import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emits a self-contained server bundle with only the files actually reached,
  // which is what the Dockerfile copies into its runtime stage. Vercel does not
  // need it, but it keeps the container image small and the two deployment
  // paths building from the same source.
  output: "standalone",
};

export default nextConfig;
