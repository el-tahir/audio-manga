/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Include the credentials file in the build output
    outputFileTracingIncludes: {
      '/**/*': ['google-credentials.json'], // Removed './' prefix
    },
  },
  images: {
    domains: ['storage.googleapis.com'],
  },
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    ignoreBuildErrors: true,
  },
};

module.exports = nextConfig;
