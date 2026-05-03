export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  process.env.API_BASE_URL ||
  'http://localhost:3001';

export const MICROSOFT_CONFIG = {
  clientId: process.env.EXPO_PUBLIC_MICROSOFT_CLIENT_ID || process.env.MICROSOFT_CLIENT_ID || '',
  tenantId: process.env.EXPO_PUBLIC_MICROSOFT_TENANT_ID || process.env.MICROSOFT_TENANT_ID || '',
  redirectUri: process.env.EXPO_PUBLIC_MICROSOFT_REDIRECT_URI || process.env.MICROSOFT_REDIRECT_URI || '',
  scopes: [
    'openid',
    'profile',
    'email',
    'User.Read',
    'Mail.Read',
    'Calendars.Read',
    'offline_access'
  ]
};

export const CANVAS_CONFIG = {
  baseUrl: process.env.CANVAS_BASE_URL || 'https://canvas.iastate.edu',
  apiKey: process.env.CANVAS_API_KEY || ''
};

export const WORKDAY_CONFIG = {
  baseUrl: process.env.WORKDAY_BASE_URL || '',
  clientId: process.env.WORKDAY_CLIENT_ID || '',
  clientSecret: process.env.WORKDAY_CLIENT_SECRET || ''
};

export const CYRIDE_CONFIG = {
  baseUrl: process.env.CYRIDE_BASE_URL || 'https://api.cyride.com',
  apiKey: process.env.CYRIDE_API_KEY || ''
};

export const APP_CONFIG = {
  name: 'Cybuddy',
  version: '1.0.0',
  description: 'AI University Copilot for Iowa State University'
};

export const REFRESH_INTERVALS = {
  dashboard: 5 * 60 * 1000, // 5 minutes
  assignments: 10 * 60 * 1000, // 10 minutes
  emails: 2 * 60 * 1000, // 2 minutes
  notifications: 5 * 60 * 1000, // 5 minutes
  cyride: 30 * 1000 // 30 seconds
};
