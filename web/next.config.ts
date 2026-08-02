import createMDX from "@next/mdx";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "api.dicebear.com",
        pathname: "/**",
      },
    ],
    formats: ["image/avif", "image/webp"],
    dangerouslyAllowSVG: true,
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
};

// No remark/rehype plugins on purpose. Under Turbopack they must be passed as
// strings, which @next/mdx resolves with require.resolve(p, { paths: [this.context] })
// — and this.context is a webpack-only loader-context field. Changelog entries
// carry their metadata as `export const meta`, so no frontmatter plugin is needed.
const withMDX = createMDX({});

export default withMDX(nextConfig);
