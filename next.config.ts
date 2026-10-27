import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // Hosts and Venue & banner moved into one Manage page.
  async redirects() {
    return [
      {
        source: "/open-plays/:id/details",
        destination: "/open-plays/:id/manage",
        permanent: true,
      },
      {
        source: "/open-plays/:id/hosts",
        destination: "/open-plays/:id/manage",
        permanent: true,
      },
    ];
  },
  partialPrefetching: true,
  experimental: {
    // A banner and a group logo can ride along with the New open play form.
    serverActions: { bodySizeLimit: "2mb" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
