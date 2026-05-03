import express from 'express';
import { ConfidentialClientApplication } from '@azure/msal-node';
import { config } from '../config';
import { generateToken, authenticateToken } from '../middleware/auth';
import { User } from '@cypilot/shared';

const router = express.Router();

const requiredMicrosoftEnv = [
  ['MICROSOFT_CLIENT_ID', config.microsoft.clientId],
  ['MICROSOFT_CLIENT_SECRET', config.microsoft.clientSecret],
  ['MICROSOFT_TENANT_ID', config.microsoft.tenantId],
  ['MICROSOFT_REDIRECT_URI', config.microsoft.redirectUri]
] as const;

const missingMicrosoftEnv = requiredMicrosoftEnv
  .filter(([, value]) => !value)
  .map(([name]) => name);

const isMicrosoftAuthConfigured = missingMicrosoftEnv.length === 0;
const isDevAuthBypassEnabled =
  config.server.nodeEnv !== 'production' &&
  process.env.ENABLE_DEV_AUTH_BYPASS !== 'false';

const sendMicrosoftAuthConfigError = (res: express.Response): void => {
  res.status(503).json({
    success: false,
    error: {
      code: 'MICROSOFT_AUTH_NOT_CONFIGURED',
      message: `Missing required environment variables: ${missingMicrosoftEnv.join(', ')}`
    },
    timestamp: new Date().toISOString()
  });
};

// Initialize MSAL only when all required env vars are present.
const msalConfig = {
  auth: {
    clientId: config.microsoft.clientId,
    clientSecret: config.microsoft.clientSecret,
    authority: `https://login.microsoftonline.com/${config.microsoft.tenantId}`
  },
  system: {
    loggerOptions: {
      loggerCallback: (level: any, message: string) => {
        if (config.server.nodeEnv === 'development') {
          console.log(message);
        }
      },
      piiLoggingEnabled: false,
      logLevel: config.server.nodeEnv === 'development' ? 'Info' : 'Error'
    }
  }
};

const cca = isMicrosoftAuthConfigured
  ? new ConfidentialClientApplication(msalConfig)
  : null;

// Login endpoint - redirect to Microsoft OAuth
router.get('/login', async (req, res) => {
  if (!cca) {
    sendMicrosoftAuthConfigError(res);
    return;
  }

  try {
    const authCodeUrlParameters = {
      scopes: ['openid', 'profile', 'email', 'User.Read', 'Mail.Read', 'Calendars.Read'],
      redirectUri: config.microsoft.redirectUri,
      state: req.query.state as string || 'default'
    };

    const authUrl = await cca.getAuthCodeUrl(authCodeUrlParameters);
    res.json({
      success: true,
      data: { authUrl },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'LOGIN_FAILED',
        message: 'Failed to initiate login'
      },
      timestamp: new Date().toISOString()
    });
  }
});

// Development-only login bypass
router.post('/dev-login', (req, res) => {
  if (!isDevAuthBypassEnabled) {
    res.status(403).json({
      success: false,
      error: {
        code: 'DEV_AUTH_DISABLED',
        message: 'Development authentication bypass is disabled'
      },
      timestamp: new Date().toISOString()
    });
    return;
  }

  const email = (typeof req.body?.email === 'string' && req.body.email) || 'dev.user@iastate.edu';
  const name = (typeof req.body?.name === 'string' && req.body.name) || 'Dev User';
  const universityId = email.includes('@') ? email.split('@')[0] : 'devuser';

  const user: User = {
    id: `dev-${Date.now()}`,
    email,
    name,
    universityId,
    profilePicture: undefined
  };

  const jwtToken = generateToken(user, 'dev-access-token');

  res.json({
    success: true,
    data: {
      user,
      tokens: {
        accessToken: jwtToken,
        refreshToken: 'dev-refresh-token',
        expiresAt: Date.now() + (24 * 60 * 60 * 1000)
      }
    },
    timestamp: new Date().toISOString()
  });
});

// Callback endpoint - handle OAuth callback
router.post('/callback', async (req, res) => {
  if (!cca) {
    sendMicrosoftAuthConfigError(res);
    return;
  }

  try {
    const { code } = req.body;

    if (!code) {
      res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_CODE',
          message: 'Authorization code is required'
        },
        timestamp: new Date().toISOString()
      });
      return;
    }

    const tokenRequest = {
      code,
      scopes: ['openid', 'profile', 'email', 'User.Read', 'Mail.Read', 'Calendars.Read'],
      redirectUri: config.microsoft.redirectUri
    };

    const response = await cca.acquireTokenByCode(tokenRequest);
    
    if (!response.account) {
      throw new Error('No account information received');
    }

    // Create user object
    const user: User = {
      id: response.account.homeAccountId,
      email: response.account.username,
      name: response.account.name || response.account.username,
      universityId: response.account.username.split('@')[0], // Extract ISU ID from email
      profilePicture: undefined
    };

    // Generate JWT token
    const jwtToken = generateToken(user, response.accessToken);

    res.json({
      success: true,
      data: {
        user,
        tokens: {
          accessToken: jwtToken,
          refreshToken: response.refreshToken || '',
          expiresAt: Date.now() + (3600 * 1000) // 1 hour from now
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'CALLBACK_FAILED',
        message: 'Failed to process authentication callback'
      },
      timestamp: new Date().toISOString()
    });
  }
});

// Refresh token endpoint
router.post('/refresh', authenticateToken, async (req, res) => {
  try {
    // In a real implementation, you would:
    // 1. Validate the refresh token
    // 2. Exchange it for new access token
    // 3. Return new JWT token
    
    res.json({
      success: true,
      data: {
        message: 'Token refresh not implemented yet'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'REFRESH_FAILED',
        message: 'Failed to refresh token'
      },
      timestamp: new Date().toISOString()
    });
  }
});

// Logout endpoint
router.post('/logout', authenticateToken, (req, res) => {
  res.json({
    success: true,
    data: {
      message: 'Logged out successfully'
    },
    timestamp: new Date().toISOString()
  });
});

// Get current user
router.get('/me', authenticateToken, (req, res) => {
  res.json({
    success: true,
    data: { user: req.user },
    timestamp: new Date().toISOString()
  });
});

export { router as authRouter };
