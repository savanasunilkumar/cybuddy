import dotenv from 'dotenv';

dotenv.config();

export const config = {
  server: {
    port: parseInt(process.env.PORT || '3001', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000'
  },
  microsoft: {
    clientId: process.env.MICROSOFT_CLIENT_ID || '',
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET || '',
    tenantId: process.env.MICROSOFT_TENANT_ID || '',
    redirectUri: process.env.MICROSOFT_REDIRECT_URI || ''
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'fallback-secret-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h'
  },
  canvas: {
    baseUrl: process.env.CANVAS_BASE_URL || 'https://canvas.iastate.edu',
    apiKey: process.env.CANVAS_API_KEY || ''
  },
  workday: {
    baseUrl: process.env.WORKDAY_BASE_URL || '',
    clientId: process.env.WORKDAY_CLIENT_ID || '',
    clientSecret: process.env.WORKDAY_CLIENT_SECRET || ''
  },
  cyride: {
    baseUrl: process.env.CYRIDE_BASE_URL || 'https://api.cyride.com',
    apiKey: process.env.CYRIDE_API_KEY || ''
  },
  ai: {
    proxyUrl: process.env.AI_PROXY_URL || '',
    proxyToken: process.env.AI_PROXY_TOKEN || '',
    model: process.env.AI_MODEL || '@cf/moonshotai/kimi-k2.6'
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    password: process.env.REDIS_PASSWORD || undefined
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10)
  }
};

export default config;
