import axios from 'axios';
import { LoginResponse, User, AuthTokens } from '@cypilot/shared';
import { getApiBaseUrl } from '../config/api';

class AuthService {
  private baseUrl = getApiBaseUrl();

  async getLoginUrl(state: string = 'default'): Promise<{ success: boolean; data?: { authUrl: string }; error?: string }> {
    try {
      const response = await axios.get(`${this.baseUrl}/auth/login`, {
        params: { state }
      });

      return {
        success: response.data.success,
        data: response.data.data
      };
    } catch (error) {
      console.error('Error getting login URL:', error);
      const message = axios.isAxiosError(error)
        ? ((error.response?.data as any)?.error?.message || error.message)
        : error instanceof Error
          ? error.message
          : 'Unknown login URL error';
      return { success: false, error: message };
    }
  }

  async exchangeCodeForTokens(authorizationCode: string): Promise<{ success: boolean; data?: LoginResponse; error?: string }> {
    try {
      const response = await axios.post(`${this.baseUrl}/auth/callback`, {
        code: authorizationCode,
        state: 'default'
      });

      return {
        success: response.data.success,
        data: response.data.data
      };
    } catch (error) {
      console.error('Error exchanging code for tokens:', error);
      const message = axios.isAxiosError(error)
        ? ((error.response?.data as any)?.error?.message || error.message)
        : error instanceof Error
          ? error.message
          : 'Unknown callback error';
      return { success: false, error: message };
    }
  }

  async devLogin(name: string = 'Dev User', email: string = 'dev.user@iastate.edu'): Promise<{ success: boolean; data?: LoginResponse; error?: string }> {
    try {
      const response = await axios.post(`${this.baseUrl}/auth/dev-login`, {
        name,
        email
      });

      return {
        success: response.data.success,
        data: response.data.data
      };
    } catch (error) {
      console.error('Error in dev login:', error);
      const message = axios.isAxiosError(error)
        ? ((error.response?.data as any)?.error?.message || error.message)
        : error instanceof Error
          ? error.message
          : 'Unknown dev login error';
      return { success: false, error: message };
    }
  }

  async refreshTokens(refreshToken: string): Promise<{ success: boolean; data?: { tokens: AuthTokens } }> {
    try {
      const response = await axios.post(`${this.baseUrl}/auth/refresh`, {
        refreshToken
      });

      return {
        success: response.data.success,
        data: response.data.data
      };
    } catch (error) {
      console.error('Error refreshing tokens:', error);
      return { success: false };
    }
  }

  async revokeTokens(refreshToken: string): Promise<{ success: boolean }> {
    try {
      await axios.post(`${this.baseUrl}/auth/logout`, {
        refreshToken
      });

      return { success: true };
    } catch (error) {
      console.error('Error revoking tokens:', error);
      return { success: false };
    }
  }

  async getCurrentUser(accessToken: string): Promise<{ success: boolean; data?: { user: User } }> {
    try {
      const response = await axios.get(`${this.baseUrl}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      return {
        success: response.data.success,
        data: response.data.data
      };
    } catch (error) {
      console.error('Error getting current user:', error);
      return { success: false };
    }
  }
}

export const authService = new AuthService();
