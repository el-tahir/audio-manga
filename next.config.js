/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Disable automatic font optimization (skip Google Fonts download at build)
    optimizeFonts: false,
  },
  images: {
    domains: ['storage.googleapis.com'],
  },
};

module.exports = nextConfig;
