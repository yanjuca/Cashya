import AsyncStorage from '@react-native-async-storage/async-storage';

export const DEMO_MODE = true;
export const DEMO_RESET_CODE = '123456';

const AUTH_KEYS = {
  ACCOUNTS: '@cashya:auth_accounts',
} as const;

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

interface StoredAccount extends AuthUser {
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

const NETWORK_DELAY_MS = 700;

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

function hashPassword(password: string): string {
  let h1 = 5381;
  let h2 = 52711;
  for (let i = 0; i < password.length; i++) {
    const code = password.charCodeAt(i);
    h1 = (h1 * 33) ^ code;
    h2 = (h2 * 33) ^ code;
  }
  return `${(h1 >>> 0).toString(16)}${(h2 >>> 0).toString(16)}`;
}

function toPublicUser(account: StoredAccount): AuthUser {
  return {
    id: account.id,
    name: account.name,
    email: account.email,
    createdAt: account.createdAt,
  };
}

async function readAccounts(): Promise<StoredAccount[]> {
  try {
    const raw = await AsyncStorage.getItem(AUTH_KEYS.ACCOUNTS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Error reading accounts from storage:', error);
    return [];
  }
}

async function writeAccounts(accounts: StoredAccount[]): Promise<void> {
  try {
    await AsyncStorage.setItem(AUTH_KEYS.ACCOUNTS, JSON.stringify(accounts));
  } catch (error) {
    console.error('Error saving accounts to storage:', error);
    throw error;
  }
}

export const AuthService = {
  async getAccountSummary(): Promise<{ count: number; firstEmail: string | null }> {
    const accounts = await readAccounts();
    return {
      count: accounts.length,
      firstEmail: accounts.length > 0 ? accounts[0].email : null,
    };
  },

  async getFirstUser(): Promise<AuthUser | null> {
    const accounts = await readAccounts();
    return accounts.length > 0 ? toPublicUser(accounts[0]) : null;
  },

  async removeAccounts(): Promise<AuthResult> {
    try {
      await AsyncStorage.removeItem(AUTH_KEYS.ACCOUNTS);
      return { success: true };
    } catch (error) {
      console.error('Error removing accounts from storage:', error);
      return { success: false, message: 'Could not remove your account. Please try again.' };
    }
  },

  async register(payload: RegisterPayload): Promise<AuthResult<AuthUser>> {
    await wait(NETWORK_DELAY_MS);
    const email = normalizeEmail(payload.email);
    const accounts = await readAccounts();

    if (accounts.some((account) => account.email === email)) {
      return { success: false, message: 'An account with this email already exists.' };
    }

    const account: StoredAccount = {
      id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
      name: payload.name.trim(),
      email,
      createdAt: new Date().toISOString(),
      passwordHash: hashPassword(payload.password),
    };

    try {
      await writeAccounts([...accounts, account]);
    } catch {
      return { success: false, message: 'Could not create your account. Please try again.' };
    }

    return { success: true, data: toPublicUser(account) };
  },

  async login(payload: LoginPayload): Promise<AuthResult<AuthUser>> {
    await wait(NETWORK_DELAY_MS);
    const email = normalizeEmail(payload.email);
    const accounts = await readAccounts();
    const account = accounts.find((item) => item.email === email);

    if (!account || account.passwordHash !== hashPassword(payload.password)) {
      return { success: false, message: 'Incorrect email or password.' };
    }

    return { success: true, data: toPublicUser(account) };
  },

  async requestPasswordReset(email: string): Promise<AuthResult> {
    await wait(NETWORK_DELAY_MS);
    normalizeEmail(email);
    return { success: true };
  },

  async resetPassword(payload: ResetPasswordPayload): Promise<AuthResult> {
    await wait(NETWORK_DELAY_MS);
    const email = normalizeEmail(payload.email);
    const accounts = await readAccounts();
    const index = accounts.findIndex((item) => item.email === email);

    if (index === -1 || payload.code !== DEMO_RESET_CODE) {
      return { success: false, message: 'Invalid or expired code.' };
    }

    const updated = [...accounts];
    updated[index] = { ...updated[index], passwordHash: hashPassword(payload.newPassword) };

    try {
      await writeAccounts(updated);
    } catch {
      return { success: false, message: 'Could not update your password. Please try again.' };
    }

    return { success: true };
  },
};