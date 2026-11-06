import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  // Allow dev assets/HMR when browsing via the local hosts-file domain
  // (needed so the cookie domain matches .iriskreinsurance.com).
  allowedDevOrigins: ['local.iriskreinsurance.com'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'dev.workphelo.datrixtechsolutions.com',
      },
      {
        protocol: 'https',
        hostname: 'dev.iriskreinsurance.com',
      },
      {
        protocol: 'https',
        hostname: 'api-dev.iriskreinsurance.com',
      },
      {
        protocol: 'https',
        hostname: 'iriskreinsurance.com',
      },
      {
        protocol: 'https',
        hostname: 'api.iriskreinsurance.com',
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
    const apiBase =
      process.env.NEXT_PUBLIC_API_URL ?? 'https://api-dev.iriskreinsurance.com/api/v1';
    return [
      {
        source: '/api/v1/:path*',
        destination: `${apiBase}/:path*`,
      },
    ];
  },
};

export default nextConfig;
