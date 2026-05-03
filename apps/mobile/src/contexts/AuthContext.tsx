import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { AuthState } from '@cypilot/shared';
import { authService } from '../services/auth';
import { setAuthFailureHandler } from './../services/api';
import { MICROSOFT_CONFIG } from '@cypilot/shared';

WebBrowser.maybeCompleteAuthSession();

interface AuthContextType extends AuthState {
  login: () => Promise<void>;
  logout: () => Promise<void>;
  refreshTokens: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

const getAuthorizationCodeFromUrl = (callbackUrl: string): string | null => {
  try {
    return new URL(callbackUrl).searchParams.get('code');
  } catch {
    const query = callbackUrl.split('?')[1] ?? '';
    return new URLSearchParams(query).get('code');
  }
};

const isDevAuthEnabled = process.env.EXPO_PUBLIC_ENABLE_DEV_AUTH !== 'false';

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    tokens: null,
    isLoading: true
  });

  useEffect(() => {
    loadStoredAuth();
  }, []);

  // Let the API layer kick the user back to the login screen when a stored
  // token stops verifying server-side (e.g. JWT secret rotation, revoke).
  useEffect(() => {
    setAuthFailureHandler(() => {
      setAuthState({
        isAuthenticated: false,
        user: null,
        tokens: null,
        isLoading: false
      });
    });
    return () => setAuthFailureHandler(null);
  }, []);

  const loadStoredAuth = async () => {
    try {
      const storedUser = await SecureStore.getItemAsync('user');
      const storedTokens = await SecureStore.getItemAsync('tokens');

      if (storedUser && storedTokens) {
        const user = JSON.parse(storedUser);
        const tokens = JSON.parse(storedTokens);

        // Check if tokens are still valid
        if (tokens.expiresAt > Date.now()) {
          setAuthState({
            isAuthenticated: true,
            user,
            tokens,
            isLoading: false
          });
        } else {
          // Try to refresh tokens
          try {
            await refreshTokens();
          } catch (error) {
            console.error('Failed to refresh tokens:', error);
            await logout();
          }
        }
      } else {
        setAuthState(prev => ({ ...prev, isLoading: false }));
      }
    } catch (error) {
      console.error('Error loading stored auth:', error);
      setAuthState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const login = async () => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true }));

      const completeLogin = async (authData: { user: AuthState['user']; tokens: AuthState['tokens'] }) => {
        if (!authData.user || !authData.tokens) {
          throw new Error('Missing auth payload');
        }

        await SecureStore.setItemAsync('user', JSON.stringify(authData.user));
        await SecureStore.setItemAsync('tokens', JSON.stringify(authData.tokens));

        setAuthState({
          isAuthenticated: true,
          user: authData.user,
          tokens: authData.tokens,
          isLoading: false
        });
      };

      const useDevAuthBypass = isDevAuthEnabled && (!MICROSOFT_CONFIG.clientId || !MICROSOFT_CONFIG.tenantId);
      if (useDevAuthBypass) {
        const devAuthResult = await authService.devLogin();
        if (!devAuthResult.success || !devAuthResult.data) {
          throw new Error(devAuthResult.error || 'Failed to login with development bypass');
        }

        await completeLogin(devAuthResult.data);
        return;
      }

      const loginUrlResult = await authService.getLoginUrl();
      if (!loginUrlResult.success || !loginUrlResult.data?.authUrl) {
        throw new Error(loginUrlResult.error || 'Failed to get login URL from backend');
      }

      const redirectUrl = MICROSOFT_CONFIG.redirectUri || 'cypilot://auth';
      const authSessionResult = await WebBrowser.openAuthSessionAsync(
        loginUrlResult.data.authUrl,
        redirectUrl
      );

      if (authSessionResult.type === 'success') {
        const authorizationCode = getAuthorizationCodeFromUrl(authSessionResult.url);
        if (!authorizationCode) {
          throw new Error('No authorization code in callback URL');
        }

        // Exchange authorization code for tokens
        const authResult = await authService.exchangeCodeForTokens(authorizationCode);
        
        if (authResult.success && authResult.data) {
          await completeLogin(authResult.data);
        } else {
          throw new Error(authResult.error || 'Failed to exchange code for tokens');
        }
      } else {
        throw new Error(`Authentication was not completed (${authSessionResult.type})`);
      }
    } catch (error) {
      console.error('Login error:', error);
      setAuthState(prev => ({ 
        ...prev, 
        isLoading: false,
        isAuthenticated: false,
        user: null,
        tokens: null
      }));
      throw error;
    }
  };

  const logout = async () => {
    try {
      // Clear stored data
      await SecureStore.deleteItemAsync('user');
      await SecureStore.deleteItemAsync('tokens');

      // Revoke tokens if available
      if (authState.tokens?.refreshToken) {
        try {
          await authService.revokeTokens(authState.tokens.refreshToken);
        } catch (error) {
          console.error('Error revoking tokens:', error);
        }
      }

      setAuthState({
        isAuthenticated: false,
        user: null,
        tokens: null,
        isLoading: false
      });
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const refreshTokens = async () => {
    try {
      if (!authState.tokens?.refreshToken) {
        throw new Error('No refresh token available');
      }

      const result = await authService.refreshTokens(authState.tokens.refreshToken);
      
      if (result.success && result.data) {
        const { tokens } = result.data;
        
        await SecureStore.setItemAsync('tokens', JSON.stringify(tokens));
        
        setAuthState(prev => ({
          ...prev,
          tokens
        }));
      } else {
        throw new Error('Failed to refresh tokens');
      }
    } catch (error) {
      console.error('Token refresh error:', error);
      await logout();
      throw error;
    }
  };

  const value: AuthContextType = {
    ...authState,
    login,
    logout,
    refreshTokens
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
