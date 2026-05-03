import Constants from 'expo-constants';

const DEFAULT_BACKEND_PORT = process.env.EXPO_PUBLIC_BACKEND_PORT || '3001';

const normalizeBaseUrl = (url: string): string => url.replace(/\/+$/, '');

const getExpoHost = (): string | null => {
  const expoConfigHostUri = (Constants.expoConfig as any)?.hostUri as string | undefined;
  const manifestDebuggerHost = (Constants as any)?.manifest?.debuggerHost as string | undefined;
  const manifest2HostUri = (Constants as any)?.manifest2?.extra?.expoClient?.hostUri as string | undefined;
  const hostUri = expoConfigHostUri || manifestDebuggerHost || manifest2HostUri;

  if (!hostUri) {
    return null;
  }

  const host = hostUri.split(':')[0];
  return host || null;
};

export const getApiBaseUrl = (): string => {
  const explicitBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || process.env.API_BASE_URL;
  if (explicitBaseUrl) {
    return normalizeBaseUrl(explicitBaseUrl);
  }

  const expoHost = getExpoHost();
  if (expoHost && expoHost !== 'localhost' && !expoHost.endsWith('.exp.direct')) {
    return `http://${expoHost}:${DEFAULT_BACKEND_PORT}`;
  }

  return `http://localhost:${DEFAULT_BACKEND_PORT}`;
};

