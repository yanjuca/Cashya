import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  AuthResult,
  AuthService,
  AuthUser,
  LoginPayload,
  RegisterPayload,
  ResetPasswordPayload,
} from '../services/auth';
import {
  BiometricInfo,
  BiometricPreference,
  BiometricService,
  NO_BIOMETRICS,
} from '../services/biometrics';

export type AuthMode = 'login' | 'register' | 'forgot' | 'reset';

export interface AuthContextValue {
  user: AuthUser | null;
  hasAccount: boolean;
  isReady: boolean;
  visible: boolean;
  locked: boolean;
  mode: AuthMode;
  prefillEmail: string;
  biometricAvailable: boolean;
  biometricEnabled: boolean;
  biometricAsked: boolean;
  biometricLabel: string;
  biometricIcon: BiometricInfo['icon'];
  unlockWithBiometrics: () => Promise<boolean>;
  setBiometricEnabled: (enabled: boolean) => Promise<boolean>;
  setMode: (mode: AuthMode) => void;
  openAuth: (mode?: AuthMode) => void;
  closeAuth: () => void;
  register: (payload: RegisterPayload) => Promise<AuthResult<AuthUser>>;
  login: (payload: LoginPayload) => Promise<AuthResult<AuthUser>>;
  logout: () => void;
  removeAccount: () => Promise<AuthResult>;
  requestPasswordReset: (email: string) => Promise<AuthResult>;
  resetPassword: (payload: ResetPasswordPayload) => Promise<AuthResult>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [hasAccount, setHasAccount] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [visible, setVisible] = useState(false);
  const [locked, setLocked] = useState(false);
  const [mode, setMode] = useState<AuthMode>('login');
  const [prefillEmail, setPrefillEmail] = useState('');
  const [biometricInfo, setBiometricInfo] = useState<BiometricInfo>(NO_BIOMETRICS);
  const [biometricPref, setBiometricPref] = useState<BiometricPreference>(null);

  const unlockWithBiometrics = useCallback(async (): Promise<boolean> => {
    const verified = await BiometricService.authenticate('Unlock Cashya');
    if (!verified) return false;
    const account = await AuthService.getFirstUser();
    if (!account) return false;
    setUser(account);
    setPrefillEmail(account.email);
    setVisible(false);
    return true;
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      let shouldPrompt = false;
      try {
        const [summary, info, pref] = await Promise.all([
          AuthService.getAccountSummary(),
          BiometricService.getInfo(),
          BiometricService.getPreference(),
        ]);
        if (cancelled) return;
        setBiometricInfo(info);
        setBiometricPref(pref);
        if (summary.count > 0) {
          setHasAccount(true);
          setPrefillEmail(summary.firstEmail ?? '');
          setMode('login');
          setLocked(true);
          setVisible(true);
          shouldPrompt = info.available && pref === 'enabled';
        }
      } catch (err) {
        console.error('Failed to load account state:', err);
      } finally {
        if (!cancelled) setIsReady(true);
      }

      if (shouldPrompt && !cancelled) {
        await new Promise<void>((resolve) => setTimeout(resolve, 350));
        if (!cancelled) unlockWithBiometrics();
      }
    }

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, [unlockWithBiometrics]);

  const setBiometricEnabled = useCallback(
    async (enabled: boolean): Promise<boolean> => {
      if (enabled) {
        if (!biometricInfo.available) return false;
        const verified = await BiometricService.authenticate(
          `Confirm to enable ${biometricInfo.label}`
        );
        if (!verified) return false;
        await BiometricService.setPreference('enabled');
        setBiometricPref('enabled');
        return true;
      }
      await BiometricService.setPreference('disabled');
      setBiometricPref('disabled');
      return true;
    },
    [biometricInfo]
  );

  const openAuth = useCallback((nextMode: AuthMode = 'login') => {
    setMode(nextMode);
    setLocked(false);
    setVisible(true);
  }, []);

  const closeAuth = useCallback(() => {
    setVisible(false);
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    const result = await AuthService.register(payload);
    if (result.success && result.data) {
      setUser(result.data);
      setHasAccount(true);
      setPrefillEmail(result.data.email);
      setVisible(false);
    }
    return result;
  }, []);

  const login = useCallback(async (payload: LoginPayload) => {
    const result = await AuthService.login(payload);
    if (result.success && result.data) {
      setUser(result.data);
      setPrefillEmail(result.data.email);
      setVisible(false);
    }
    return result;
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setMode('login');
    setLocked(true);
    setVisible(true);
    if (biometricInfo.available && biometricPref === 'enabled') {
      setTimeout(() => {
        unlockWithBiometrics();
      }, 350);
    }
  }, [biometricInfo, biometricPref, unlockWithBiometrics]);

  const removeAccount = useCallback(async (): Promise<AuthResult> => {
    if (!user) {
      return { success: false, message: 'Log in to remove your account.' };
    }
    const result = await AuthService.removeAccounts();
    if (result.success) {
      await BiometricService.clearPreference();
      setBiometricPref(null);
      setUser(null);
      setHasAccount(false);
      setPrefillEmail('');
      setMode('login');
      setLocked(false);
      setVisible(false);
    }
    return result;
  }, [user]);

  const requestPasswordReset = useCallback(async (email: string) => {
    return AuthService.requestPasswordReset(email);
  }, []);

  const resetPassword = useCallback(async (payload: ResetPasswordPayload) => {
    const result = await AuthService.resetPassword(payload);
    if (result.success) {
      setPrefillEmail(payload.email.trim().toLowerCase());
    }
    return result;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      hasAccount,
      isReady,
      visible,
      locked,
      mode,
      prefillEmail,
      biometricAvailable: biometricInfo.available,
      biometricEnabled: biometricInfo.available && biometricPref === 'enabled',
      biometricAsked: biometricPref !== null,
      biometricLabel: biometricInfo.label,
      biometricIcon: biometricInfo.icon,
      unlockWithBiometrics,
      setBiometricEnabled,
      setMode,
      openAuth,
      closeAuth,
      register,
      login,
      logout,
      removeAccount,
      requestPasswordReset,
      resetPassword,
    }),
    [
      user,
      hasAccount,
      isReady,
      visible,
      locked,
      mode,
      prefillEmail,
      biometricInfo,
      biometricPref,
      unlockWithBiometrics,
      setBiometricEnabled,
      openAuth,
      closeAuth,
      register,
      login,
      logout,
      removeAccount,
      requestPasswordReset,
      resetPassword,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}