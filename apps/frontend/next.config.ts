import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  productionBrowserSourceMaps: false,

  // Enable bundle analysis via ANALYZE=true env
  ...(process.env["ANALYZE"] === "true" && {
    webpack: (config: Record<string, unknown>) => {
      // Dynamic import of bundle analyzer only when needed
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { BundleAnalyzerPlugin } = require("@next/bundle-analyzer")();
      (config as { plugins: unknown[] }).plugins.push(
        new BundleAnalyzerPlugin({ analyzerMode: "static", openAnalyzer: false })
      );
      return config;
    },
  }),

  // Transpile shared packages
  transpilePackages: [
    "@legalir/types",
    "@legalir/config",
    "@legalir/validation",
    "@legalir/api-client",
    "@legalir/ui",
    "@legalir/i18n",
    "@legalir/testing",
  ],

  // Optimize package imports for tree-shaking
  experimental: {
    optimizePackageImports: ["@legalir/ui", "@legalir/types", "@tanstack/react-query"],
  },

  // Image optimization
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [320, 375, 600, 900, 1024, 1440],
    minimumCacheTTL: 60 * 60 * 24,
  },

  // Compress responses
  compress: true,

  // Security headers
  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-XSS-Protection", value: "1; mode=block" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      ],
    },
  ],
};

export default nextConfig;
