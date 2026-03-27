import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const nextConfig: NextConfig = {
  devIndicators: false,
  turbopack: {
    root: import.meta.dirname,
  },
};

export default withBundleAnalyzer(nextConfig);
