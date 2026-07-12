import type { NextConfig } from "next"
import { withSentryConfig } from "@sentry/nextjs"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const SUPABASE_HOST = SUPABASE_URL ? new URL(SUPABASE_URL).hostname : ''

const nextConfig: NextConfig = {
  // These packages use Node.js-specific internals (crypto, tls, net) that webpack
  // cannot bundle for the App Router runtime. Resolving them externally prevents
  // the "module-not-found" error when any route imports ratelimit.ts -> @upstash/redis.
  serverExternalPackages: ['@upstash/redis', '@upstash/ratelimit'],

  // Allow HMR from VirtualBox host-only network in local dev
  allowedDevOrigins: ['192.168.56.1'],

  experimental: {
    optimizePackageImports: [
      'lucide-react',
      '@base-ui/react',
      '@dnd-kit/core',
      '@dnd-kit/sortable',
      '@dnd-kit/utilities',
      'sonner',
      'next-themes',
    ],
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), geolocation=(), microphone=(self)',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              `img-src 'self' data: blob: ${SUPABASE_HOST}`,
              "font-src 'self' data:",
              // Sentry DSN endpoint added to connect-src
              `connect-src 'self' ${SUPABASE_HOST} *.supabase.co wss://*.supabase.co https://api.groq.com https://api.voyageai.com https://*.upstash.io https://*.ingest.sentry.io`,
              "frame-src 'none'",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
    ]
  },
}

export default withSentryConfig(nextConfig, {
  // Sentry organization and project (set in CI secrets / .env.local)
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Only print Sentry build output in CI
  silent: !process.env.CI,

  // Upload larger set of source maps for better stack traces
  widenClientFileUpload: true,

  // Hide source maps from the browser bundle in production
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },

  // Suppress Sentry SDK logger in production bundles (new API, replaces disableLogger)
  webpack: {
    treeshake: {
      removeDebugLogging: true,
    },
  },

  // Don't auto-create Vercel Cron monitors (new API, replaces automaticVercelMonitors)
  // automaticVercelMonitors was moved inside the `webpack` namespace but the
  // recommended replacement is simply omitting it (defaults to false since v9).

})
