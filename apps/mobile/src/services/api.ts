import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { getApiBaseUrl } from '../config/api';

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  timestamp?: string;
}

// Callback registered by AuthContext so the API layer can flip the app back
// to the login screen when the stored token stops working (wrong JWT secret,
// expired refresh, revoked, etc.) without coupling the two modules directly.
let authFailureHandler: (() => void) | null = null;
export const setAuthFailureHandler = (fn: (() => void) | null): void => {
  authFailureHandler = fn;
};

const unwrapApiData = <T>(payload: unknown): T => {
  if (
    payload &&
    typeof payload === 'object' &&
    'success' in payload &&
    'data' in payload
  ) {
    return (payload as ApiEnvelope<T>).data;
  }

  return payload as T;
};

class ApiService {
  private client: AxiosInstance;
  private baseUrl: string;

  constructor() {
    this.baseUrl = getApiBaseUrl();
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor to include auth token
    this.client.interceptors.request.use(
      async (config) => {
        try {
          const tokens = await SecureStore.getItemAsync('tokens');
          if (tokens) {
            const parsedTokens = JSON.parse(tokens);
            config.headers.Authorization = `Bearer ${parsedTokens.accessToken}`;
          }
        } catch (error) {
          console.error('Error getting auth token:', error);
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Add response interceptor to handle token refresh + auth failure
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        const status = error.response?.status;

        if (status === 401 && originalRequest && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            const tokens = await SecureStore.getItemAsync('tokens');
            if (tokens) {
              const parsedTokens = JSON.parse(tokens);
              const refreshResponse = await axios.post(`${this.baseUrl}/auth/refresh`, {
                refreshToken: parsedTokens.refreshToken
              });

              if (refreshResponse.data.success) {
                const newTokens = refreshResponse.data.data.tokens;
                await SecureStore.setItemAsync('tokens', JSON.stringify(newTokens));
                originalRequest.headers.Authorization = `Bearer ${newTokens.accessToken}`;
                return this.client(originalRequest);
              }
            }
          } catch (refreshError) {
            console.error('Token refresh failed:', refreshError);
          }

          // Refresh path failed — fall through to the auth-failure handling
          // below so the user lands on the login screen instead of staring
          // at a broken dashboard.
        }

        // 401 (after refresh failed) OR 403 (token verification failed —
        // wrong JWT secret, revoked, etc.) — clear stored auth and notify
        // the auth context so the app routes back to login.
        if (status === 401 || status === 403) {
          try {
            await SecureStore.deleteItemAsync('tokens');
            await SecureStore.deleteItemAsync('user');
          } catch (storageError) {
            console.error('Failed to clear stored auth on auth failure:', storageError);
          }
          authFailureHandler?.();
        }

        return Promise.reject(error);
      }
    );
  }

  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.get(url, config);
    return unwrapApiData<T>(response.data);
  }

  async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.post(url, data, config);
    return unwrapApiData<T>(response.data);
  }

  async put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.put(url, data, config);
    return unwrapApiData<T>(response.data);
  }

  async patch<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.patch(url, data, config);
    return unwrapApiData<T>(response.data);
  }

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.delete(url, config);
    return unwrapApiData<T>(response.data);
  }
}

export const apiService = new ApiService();
