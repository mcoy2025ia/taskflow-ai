import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Capture 10% of transactions for performance monitoring in production
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Capture session replays only on errors (no continuous recording)
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,

  integrations: [
    Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true }),
  ],

  debug: false,
})
