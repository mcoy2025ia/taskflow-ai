/** @type {import('@lhci/cli').LighthouseRcConfig} */
module.exports = {
  ci: {
    collect: {
      url: ['http://localhost:3000'],
      numberOfRuns: 1,
      startServerCommand: 'npm run start',
      startServerReadyPattern: 'started server on',
    },
    assert: {
      assertions: {
        'categories:performance':   ['warn', { minScore: 0.8 }],
        'categories:accessibility': ['warn', { minScore: 0.9 }],
        'first-contentful-paint':   ['warn', { maxNumericValue: 2500 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
        'cumulative-layout-shift':  ['error', { maxNumericValue: 0.1 }],
        'total-blocking-time':      ['warn', { maxNumericValue: 200 }],
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
}
