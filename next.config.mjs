/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.brawlify.com"
      }
    ]
  }
};

export default nextConfig;
