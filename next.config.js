const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

const withPWA = require('next-pwa');

/** @type {import('next').NextConfig} */
const nextConfig = withPWA({
  pwa: {
    dest: 'public',
    disable: process.env.NODE_ENV === 'development',
    skipWaiting: true,
    clientsClaim: true,
    buildExcludes: [/middleware-manifest\.json$/],
    runtimeCaching: [
      {
        urlPattern: /^\/admin(\/.*)?$/,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'admin-pages-cache',
          networkTimeoutSeconds: 10,
          expiration: {
            maxEntries: 32,
            maxAgeSeconds: 24 * 60 * 60,
          },
        },
      },
    ],
  },
  // Performance optimizations
  compress: true,
  productionBrowserSourceMaps: false,
  poweredByHeader: false,
  generateEtags: false,

  // Images configuration
  images: {
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 60 * 60 * 24 * 7, // 7 days
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    domains: []
  },

  // Headers for security and performance
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' }
        ]
      },
      {
        source: '/sw.js',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' }]
      },
      {
        source: '/manifest.json',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }]
      }
    ];
  },

  // Redirects and rewrites
  async redirects() {
    return [
      { source: '/login', destination: '/auth/login', permanent: true },
      { source: '/register', destination: '/auth/register', permanent: true }
    ];
  },

  // Webpack configuration
  webpack: (config, { dev, isServer }) => {
    // Production optimizations
    if (!dev && !isServer) {
      config.optimization.splitChunks.chunks = 'all';
    }

    // Bundle analyzer
    if (process.env.ANALYZE === 'true') {
      config.optimization.concatenateModules = false;
    }

    return config;
  },

  // TypeScript configuration
  typescript: {
    tsconfigPath: './tsconfig.json',
  },

  // Environment variables
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },

  // Output configuration for static export if needed
  output: 'standalone',

  // Compatibilité Next.js 16
  turbopack: {},

  // Nouvelle clé conforme à Next 15
  serverExternalPackages: ['@supabase/supabase-js']
});

module.exports = withBundleAnalyzer(nextConfig);
