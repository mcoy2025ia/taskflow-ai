import '@testing-library/jest-dom'

// Stub env vars that modules read at load time
process.env.VOYAGE_API_KEY = 'test-voyage-key'
process.env.EMBED_INTERNAL_SECRET = 'test-embed-secret-that-is-at-least-32-chars!!'
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
