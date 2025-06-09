import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  
  // Optimized file tracing for Cloud APIs
  outputFileTracingIncludes: {
    '/api/download-chapter/*': [
      './node_modules/@google-cloud/tasks/build/**/*.json',
    ],
  },
  
  // External packages that should not be bundled
  serverExternalPackages: [
    '@google-cloud/tasks',
    '@google-cloud/storage',
  ],
  
  // Image optimization settings
  images: {
    domains: ['storage.googleapis.com'],
    formats: ['image/webp', 'image/avif'],
  },
  
  // Build and development optimizations
  eslint: {
    ignoreDuringBuilds: false, // Enable ESLint checks during build
  },
  typescript: {
    ignoreBuildErrors: false, // Ensure TypeScript errors fail the build
  },
  
  // Headers for security and performance
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
