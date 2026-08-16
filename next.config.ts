import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Server-only AI keys. Listing them here makes the build inline the values
  // from the build environment into the server bundle. They are referenced
  // only from src/lib/ai.ts, which is imported solely by the route handler, so
  // they never reach a client bundle. Values themselves are never committed.
  env: {
    GEMINI_API_KEY: process.env.GEMINI_API_KEY ?? "",
    GROQ_API_KEY: process.env.GROQ_API_KEY ?? "",
  },
};

export default nextConfig;
