import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Constrained shared hosting may fail to spawn multiple worker processes.
    cpus: 1,
    workerThreads: true,
    turbopackPluginRuntimeStrategy: "workerThreads",
    parallelServerCompiles: false,
    parallelServerBuildTraces: false,
  },
};

export default nextConfig;
