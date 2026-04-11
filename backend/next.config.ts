import type { NextConfig } from "next";

const frontendOrigin =
  process.env.FRONTEND_ORIGIN || "http://localhost:3000";

const nextConfig: NextConfig = {
  async headers() {
    return [{
      source: '/api/:path*',
      headers: [
        { key: 'Access-Control-Allow-Origin', value: frontendOrigin },
        { key: 'Access-Control-Allow-Methods', value: 'POST, OPTIONS' },
        { key: 'Access-Control-Allow-Headers', value: 'Content-Type' }
      ]
    }]
  }
};

export default nextConfig;
