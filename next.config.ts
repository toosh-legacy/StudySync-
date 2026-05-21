import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Pin the workspace root so Turbopack doesn't pick up the stray lockfile
  // in the parent directory.
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
