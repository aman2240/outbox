import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Don't regenerate AGENTS.md/CLAUDE.md on every `next dev`/`next build`.
  agentRules: false,
};

export default nextConfig;
