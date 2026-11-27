import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { ApiError, apiRequest, RequestOptions } from './client';

/**
 * Session tokens for cashya-api.
 *
 * Native: stored in the OS keychain/keystore (expo-secure-store). Web has no secure store, so it falls back
 * to AsyncStorage (localStorage). The access token is refreshed shortly before it expires and again whenever
 * the API answers 401; refresh tokens rotate on every use, so only one refresh runs at a time.
 */

export interface ApiUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface ApiAuthData {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: ApiUser;
}

const KEYS = {
  access: 'cashya.accessToken',
  refresh: 'cashya.refreshToken',
  expiresAt: 'cashya.accessTokenExpiresAt',
} as const;

const REFRESH_MARGIN_MS = 60_000;

const useSecureStore = Platform.OS !== 'web';

async function readKey(key: string): Promise<string | null> {
  return useSecureStore ? SecureStore.getItemAsync(key) : AsyncStorage.getItem(key);
}

async function writeKey(key: string, value: string): Promise<void> {
  if (useSecureStore) await SecureStore.setItemAsync(key, value);
  else await AsyncStorage.setItem(key, value);
}

async function deleteKey(key: string): Promise<void> {
  if (useSecureStore) await SecureStore.deleteItemAsync(key);
  else await AsyncStorage.removeItem(key);
}

let refreshInFlight: Promise<string | null> | null = null;
const userListeners = new Set<(user: ApiUser) => void>();

export const Session = {
  async save(auth: ApiAuthData): Promise<void> {
    await writeKey(KEYS.access, auth.accessToken);
    await writeKey(KEYS.refresh, auth.refreshToken);
    await writeKey(KEYS.expiresAt, String(Date.now() + auth.expiresIn * 1000));
  },

  async clear(): Promise<void> {
    await Promise.all([deleteKey(KEYS.access), deleteKey(KEYS.refresh), deleteKey(KEYS.expiresAt)]);
  },

  async getRefreshToken(): Promise<string | null> {
    return readKey(KEYS.refresh);
  },

  async hasSession(): Promise<boolean> {
    return !!(await readKey(KEYS.refresh));
  },

  /** Called with the fresh profile every time tokens are refreshed (keeps the cached account in sync). */
  onUserRefreshed(listener: (user: ApiUser) => void): () => void {
    userListeners.add(listener);
    return () => userListeners.delete(listener);
  },

  /**
   * Exchange the refresh token for a new pair. Resolves with the new access token, or `null` when the server
   * rejected the refresh token (session is over: tokens are cleared). Network failures reject with ApiError.
   */
  refresh(): Promise<string | null> {
    if (!refreshInFlight) {
      refreshInFlight = (async () => {
        const refreshToken = await readKey(KEYS.refresh);
        if (!refreshToken) return null;
        try {
          const auth = await apiRequest<ApiAuthData>('/auth/refresh', { method: 'POST', body: { refreshToken } });
          await Session.save(auth);
          userListeners.forEach((listener) => listener(auth.user));
          return auth.accessToken;
        } catch (error) {
          if (error instanceof ApiError && !error.isNetworkError && error.status < 500) {
            await Session.clear();
            return null;
          }
          throw error;
        }
      })().finally(() => {
        refreshInFlight = null;
      });
    }
    return refreshInFlight;
  },

  /** A usable access token, refreshing it first when it is about to expire. `null` = not signed in. */
  async getAccessToken(): Promise<string | null> {
    const [token, expiresAt] = await Promise.all([readKey(KEYS.access), readKey(KEYS.expiresAt)]);
    if (token && Number(expiresAt) - Date.now() > REFRESH_MARGIN_MS) return token;
    return Session.refresh();
  },
};

/** apiRequest with the session's bearer token; retries once with a refreshed token on 401. */
export async function authorizedRequest<T>(path: string, options: Omit<RequestOptions, 'token'> = {}): Promise<T> {
  const token = await Session.getAccessToken();
  if (!token) throw new ApiError(401, 'You are not signed in.', 'NO_SESSION');
  try {
    return await apiRequest<T>(path, { ...options, token });
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) throw error;
    const renewed = await Session.refresh();
    if (!renewed) throw new ApiError(401, 'Your session has expired. Please log in again.', 'SESSION_EXPIRED');
    return apiRequest<T>(path, { ...options, token: renewed });
  }
}
