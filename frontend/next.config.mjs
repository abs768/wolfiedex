const backendBaseUrl = process.env.API_BASE_URL || "http://127.0.0.1:3001";

/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/search",
        destination: `${backendBaseUrl}/api/search`,
      },
    ];
  },
};

export default nextConfig;
