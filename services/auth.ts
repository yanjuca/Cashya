import AsyncStorage from '@react-native-async-storage/async-storage';

import { ApiError, ApiUser, CashyaApi, Session } from './api';

/**
 * Accounts live in cashya-api. The device only keeps the public profile of the signed-in account (to prefill
 * the e-mail and show the lock screen) and the session tokens (see services/api/session.ts).
 */

const AUTH_KEYS = {
  ACCOUNT: '@cashya:auth_account',
  // Demo-mode accounts from older builds (local password hash). Migrated to the API on the next login.
  LEGACY_ACCOUNTS: '@cashya:auth_accounts',
} as const;

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

interface LegacyAccount extends AuthUser {
  passwordHash: string;
}

export interface AuthResult<T = undefined> {
  success: boolean;
  message?: string;
  data?: T;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface ResetPasswordPayload {
  email: string;
  code: string;
  newPassword: string;
}

// Accounts are real now (cashya-api); the demo reset code banner in AuthScreen stays hidden.
export const DEMO_MODE = false;
export const DEMO_RESET_CODE = '';

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

const toAuthUser = (user: ApiUser): AuthUser => ({
  id: user.id,
  name: user.name,
  email: user.email,
  createdAt: user.createdAt,
});

function friendlyError(error: unknown, fallback: string, byStatus: Record<number, string> = {}): string {
  if (!(error instanceof ApiError)) return fallback;
  if (error.isNetworkError) return 'Could not reach the Cashya server. Check your connection and try again.';
  if (byStatus[error.status]) return byStatus[error.status];
  if (error.status === 429) return 'Too many attempts. Please wait a moment and try again.';
  if (error.status === 422 && error.details.length > 0) {
    const detail = error.details[0];
    return `${detail.field ? `${detail.field}: ` : ''}${detail.issue}`;
  }
  return error.status >= 500 ? 'The server is having trouble right now. Please try again later.' : error.message || fallback;
}

async function readAccount(): Promise<AuthUser | null> {
  try {
    const raw = await AsyncStorage.getItem(AUTH_KEYS.ACCOUNT);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

async function writeAccount(user: AuthUser): Promise<void> {
  await AsyncStorage.setItem(AUTH_KEYS.ACCOUNT, JSON.stringify(user));
}

// Keep the cached profile in step with what the server returns on token refresh.
Session.onUserRefreshed((user) => {
  writeAccount(toAuthUser(user)).catch(() => undefined);
});

// ---- legacy demo accounts --------------------------------------------------------------------------------------

function legacyHash(password: string): string {
  let h1 = 5381;
  let h2 = 52711;
  for (let i = 0; i < password.length; i++) {
    const code = password.charCodeAt(i);
    h1 = (h1 * 33) ^ code;
    h2 = (h2 * 33) ^ code;
  }
  return `${(h1 >>> 0).toString(16)}${(h2 >>> 0).toString(16)}`;
}

async function readLegacyAccounts(): Promise<LegacyAccount[]> {
  try {
    const raw = await AsyncStorage.getItem(AUTH_KEYS.LEGACY_ACCOUNTS);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// ---- service ---------------------------------------------------------------------------------------------------

export const AuthService = {
  async getAccountSummary(): Promise<{ count: number; firstEmail: string | null }> {
    const account = await readAccount();
    if (account) return { count: 1, firstEmail: account.email };
    const legacy = await readLegacyAccounts();
    return { count: legacy.length > 0 ? 1 : 0, firstEmail: legacy[0]?.email ?? null };
  },

  /** Whether this device still holds a session (refresh token), i.e. biometric unlock can work. */
  hasSession(): Promise<boolean> {
    return Session.hasSession();
  },

  /**
   * The signed-in account for biometric unlock. Requires a live session; when the server can't be reached the
   * cached profile is returned so the app still opens offline.
   */
  async getFirstUser(): Promise<AuthUser | null> {
    const account = await readAccount();
    if (!account || !(await Session.hasSession())) return null;
    try {
      return (await Session.getAccessToken()) ? account : null;
    } catch {
      return account; // offline: keep working locally, sync resumes later
    }
  },

  async removeAccounts(): Promise<AuthResult> {
    try {
      await CashyaApi.auth.logout();
      await AsyncStorage.multiRemove([AUTH_KEYS.ACCOUNT, AUTH_KEYS.LEGACY_ACCOUNTS]);
      return { success: true };
    } catch (error) {
      console.error('Error removing account from this device:', error);
      return { success: false, message: 'Could not remove your account. Please try again.' };
    }
  },

  async register(payload: RegisterPayload): Promise<AuthResult<AuthUser>> {
    try {
      const auth = await CashyaApi.auth.register({
        name: payload.name.trim(),
        email: normalizeEmail(payload.email),
        password: payload.password,
      });
      const user = toAuthUser(auth.user);
      await writeAccount(user);
      return { success: true, data: user };
    } catch (error) {
      return {
        success: false,
        message: friendlyError(error, 'Could not create your account. Please try again.', {
          409: 'An account with this email already exists.',
        }),
      };
    }
  },

  async login(payload: LoginPayload): Promise<AuthResult<AuthUser>> {
    const email = normalizeEmail(payload.email);
    try {
      const auth = await CashyaApi.auth.login({ email, password: payload.password });
      const user = toAuthUser(auth.user);
      await writeAccount(user);
      return { success: true, data: user };
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        // A demo account from an older build exists only on this phone: create it on the server once.
        const legacy = (await readLegacyAccounts()).find((account) => account.email === email);
        if (legacy && legacy.passwordHash === legacyHash(payload.password)) {
          const migrated = await AuthService.register({ name: legacy.name, email, password: payload.password });
          if (migrated.success) await AsyncStorage.removeItem(AUTH_KEYS.LEGACY_ACCOUNTS);
          return migrated;
        }
      }
      return {
        success: false,
        message: friendlyError(error, 'Could not log in. Please try again.', { 401: 'Incorrect email or password.' }),
      };
    }
  },

  /** Ends the session on this device (the account and its cloud data stay intact). */
  async logout(): Promise<void> {
    await CashyaApi.auth.logout();
  },

  async requestPasswordReset(_email: string): Promise<AuthResult> {
    return {
      success: false,
      message: 'Password recovery is not available yet. If you are logged in on another device, change it there in Settings.',
    };
  },

  async resetPassword(_payload: ResetPasswordPayload): Promise<AuthResult> {
    return { success: false, message: 'Password recovery is not available yet.' };
  },
};
