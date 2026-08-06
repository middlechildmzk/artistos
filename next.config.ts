import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/opportunities",
        destination: "/network",
        permanent: true,
      },
      {
        source: "/targets",
        has: [
          {
            type: "query",
            key: "view",
            value: "relationships",
          },
        ],
        destination: "/network?view=relationships",
        permanent: true,
      },
      {
        source: "/targets",
        destination: "/network?view=saved",
        permanent: true,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
};

export default nextConfig;
