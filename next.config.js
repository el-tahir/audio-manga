/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    // serverComponentsExternalPackages: ['@google-cloud/tasks'], // Old key
    outputFileTracingIncludes: {
      '/api/download-chapter/*': [
        // Include all .json files within the @google-cloud/tasks build directory 
        // to catch different versions (v2, v2beta2, etc.) and any other JSON configs.
        './node_modules/@google-cloud/tasks/build/**/*.json'
      ],
      // If other routes also use @google-cloud/tasks and might face similar issues, 
      // you could use a broader pattern or add specific entries for them too, e.g.:
      // '/api/*': ['./node_modules/@google-cloud/tasks/build/**/*.json'],
    },
  },
  serverExternalPackages: ['@google-cloud/tasks'], // New key
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
