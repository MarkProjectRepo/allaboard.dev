import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["knex", "pg", "pg-native"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "picsum.photos" },
      // Google account profile pictures
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "lh4.googleusercontent.com" },
      { protocol: "https", hostname: "lh5.googleusercontent.com" },
      { protocol: "https", hostname: "lh6.googleusercontent.com" },
    ],
  },
};

export default nextConfig;
