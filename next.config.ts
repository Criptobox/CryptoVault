import type { NextConfig } from "next";

/**
 * Configuración dual:
 * - Desarrollo/preview local: modo standalone normal.
 * - GitHub Pages: `NEXT_PUBLIC_OUTPUT=export NEXT_PUBLIC_BASE_PATH=/<repo>` produce
 *   un export estático en `out/` listo para publicar (ver README).
 */
const isExport = process.env.NEXT_PUBLIC_OUTPUT === "export";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  ...(isExport ? { output: "export" as const } : { output: "standalone" as const }),
  basePath: basePath || undefined,
  assetPrefix: basePath || undefined,
  images: { unoptimized: true },
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
