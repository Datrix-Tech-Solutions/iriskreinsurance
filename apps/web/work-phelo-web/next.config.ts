import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'dev.workphelo.datrixtechsolutions.com',
      },
      {
        protocol: 'https',
        hostname: 'dev-app.workphelo.com',
      },
      {
        protocol: 'https',
        hostname: 'dev-api.workphelo.com',
      },
      {
        protocol: 'https',
        hostname: 'workphelo.datrixtechsolutions.com',
      },
      {
        protocol: 'https',
        hostname: 'workphelo.com',
      },
      {
        protocol: 'https',
        hostname: 'www.workphelo.com',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
      },
    ],
    unoptimized: process.env.NODE_ENV === 'production',
  },
  async rewrites() {
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'https://dev-api.workphelo.com/api/v1';
    return [
      {
        source: '/api/v1/:path*',
        destination: `${apiBase}/:path*`,
      },
    ];
  },
};

export default nextConfig;
