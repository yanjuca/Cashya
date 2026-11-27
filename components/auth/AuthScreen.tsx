import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  BackHandler,
  Easing,
  KeyboardAvoidingView,
  KeyboardTypeOptions,
  Platform,
  ReturnKeyTypeOptions,
  ScrollView,
  StatusBar,
  StyleSheet,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAlert } from '../../contexts/AlertContext';
import { AuthMode, useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { DEMO_MODE, DEMO_RESET_CODE } from '../../services/auth';
import { BORDER_RADIUS, FONTS, hexToRgba, ThemeColors } from '../../theme';
import Text from '../ui/AppText';
import { useLanguage } from '../../contexts/LanguageContext';

type TextInputInstance = React.ComponentRef<typeof TextInput>;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

type FieldName = 'name' | 'email' | 'password' | 'confirm' | 'code';
type FieldErrors = Partial<Record<FieldName, string>>;

const triggerHaptic = (style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) => {
  if (Platform.OS !== 'web') {
    try {
      Haptics.impactAsync(style);
    } catch {}
  }
};

const triggerSuccessHaptic = () => {
  if (Platform.OS !== 'web') {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
  }
};

const triggerErrorHaptic = () => {
  if (Platform.OS !== 'web') {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } catch {}
  }
};

const PASSWORD_RULES = [
  { id: 'length', label: `At least ${MIN_PASSWORD_LENGTH} characters`, test: (pw: string) => pw.length >= MIN_PASSWORD_LENGTH },
  { id: 'upper', label: 'One uppercase letter', test: (pw: string) => /[A-Z]/.test(pw) },
  { id: 'lower', label: 'One lowercase letter', test: (pw: string) => /[a-z]/.test(pw) },
  { id: 'number', label: 'One number', test: (pw: string) => /\d/.test(pw) },
  { id: 'special', label: 'One special character', test: (pw: string) => /[^A-Za-z0-9\s]/.test(pw) },
];

const isPasswordValid = (password: string) => PASSWORD_RULES.every((rule) => rule.test(password));

const COPY: Record<AuthMode, { title: string; subtitle: string; eyebrow: string }> = {
  login: {
    eyebrow: 'LOG IN',
    title: 'welcome back',
    subtitle: 'Log in to your CASH account. It is optional, you can skip it anytime.',
  },
  register: {
    eyebrow: 'CREATE ACCOUNT',
    title: 'join cash',
    subtitle: 'Optional. CASH keeps working offline without an account.',
  },
  forgot: {
    eyebrow: 'FORGOT PASSWORD',
    title: 'reset access',
    subtitle: 'Enter your email and we will send you a 6-digit code to reset your password.',
  },
  reset: {
    eyebrow: 'NEW PASSWORD',
    title: 'new password',
    subtitle: 'Enter the code we sent to your email and choose a new password.',
  },
};

interface AuthFieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  icon: keyof typeof Ionicons.glyphMap;
  placeholder?: string;
  error?: string;
  secure?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoComplete?: TextInputProps['autoComplete'];
  maxLength?: number;
  inputRef?: React.RefObject<TextInputInstance | null>;
  returnKeyType?: ReturnKeyTypeOptions;
  onSubmitEditing?: () => void;
  code?: boolean;
  editable?: boolean;
}

function AuthField({
  label,
  value,
  onChangeText,
  icon,
  placeholder,
  error,
  secure = false,
  keyboardType,
  autoCapitalize = 'none',
  autoComplete,
  maxLength,
  inputRef,
  returnKeyType,
  onSubmitEditing,
  code = false,
  editable = true,
}: AuthFieldProps) {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);

  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View
        style={[
          styles.fieldContainer,
          focused && styles.fieldContainerFocused,
          !!error && styles.fieldContainerError,
        ]}
      >
        <Ionicons
          name={icon}
          size={18}
          color={error ? colors.error : focused ? colors.text : colors.textMuted}
          style={styles.fieldIcon}
        />
        <TextInput
          ref={inputRef}
          style={[styles.fieldInput, code && styles.fieldInputCode]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder ? t(placeholder) : undefined}
          placeholderTextColor={colors.textMuted}
          secureTextEntry={secure && hidden}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          autoCorrect={false}
          maxLength={maxLength}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          editable={editable}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          selectionColor={colors.primary}
        />
        {secure && (
          <TouchableOpacity
            onPress={() => {
              triggerHaptic();
              setHidden((prev) => !prev);
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            activeOpacity={0.7}
          >
            <Ionicons
              name={hidden ? 'eye-outline' : 'eye-off-outline'}
              size={20}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        )}
      </View>
      {!!error && (
        <View style={styles.fieldErrorRow}>
          <Ionicons name="alert-circle-outline" size={13} color={colors.error} />
          <Text style={styles.fieldErrorText}>{error}</Text>
        </View>
      )}
    </View>
  );
}

function PasswordRules({ password }: { password: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.rulesBox}>
      {PASSWORD_RULES.map((rule) => {
        const met = rule.test(password);
        return (
          <View key={rule.id} style={styles.ruleRow}>
            <Ionicons
              name={met ? 'checkmark-circle' : 'ellipse-outline'}
              size={15}
              color={met ? colors.success : colors.textMuted}
            />
            <Text style={[styles.ruleText, met && styles.ruleTextMet]}>{rule.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

interface AuthButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
}

function AuthButton({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  icon,
}: AuthButtonProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isPrimary = variant === 'primary';

  return (
    <TouchableOpacity
      style={[
        styles.button,
        isPrimary ? styles.buttonPrimary : styles.buttonSecondary,
        (disabled || loading) && styles.buttonDisabled,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
    >
      {loading ? (
        <ActivityIndicator size="small" color={isPrimary ? colors.primaryText : colors.text} />
      ) : (
        <>
          {icon && (
            <Ionicons
              name={icon}
              size={18}
              color={isPrimary ? colors.primaryText : colors.text}
            />
          )}
          <Text style={isPrimary ? styles.buttonPrimaryText : styles.buttonSecondaryText}>
            {label}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

function AuthForm() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { showAlert } = useAlert();
  const {
    hasAccount,
    locked,
    mode,
    prefillEmail,
    biometricAvailable,
    biometricAsked,
    biometricLabel,
    biometricIcon,
    setBiometricEnabled,
    setMode,
    closeAuth,
    login,
    register,
    requestPasswordReset,
    resetPassword,
  } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState(prefillEmail);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [code, setCode] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);

  const emailRef = useRef<TextInputInstance>(null);
  const passwordRef = useRef<TextInputInstance>(null);
  const confirmRef = useRef<TextInputInstance>(null);

  const resetSensitiveFields = () => {
    setPassword('');
    setConfirm('');
    setCode('');
    setErrors({});
    setFormError('');
  };

  const changeMode = (next: AuthMode) => {
    resetSensitiveFields();
    setMode(next);
  };

  const handleBack = () => {
    triggerHaptic();
    if (mode === 'reset') {
      changeMode('forgot');
    } else if (mode === 'forgot') {
      changeMode('login');
    } else if (locked && mode === 'register') {
      changeMode('login');
    } else if (!locked) {
      closeAuth();
    }
  };

  const handleBackRef = useRef(handleBack);

  useEffect(() => {
    handleBackRef.current = handleBack;
  });

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      handleBackRef.current();
      return true;
    });
    return () => subscription.remove();
  }, []);

  const clearField = (field: FieldName) => {
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
    if (formError) setFormError('');
  };

  const switchMode = (next: AuthMode) => {
    triggerHaptic();
    changeMode(next);
  };

  const handleSkip = () => {
    triggerHaptic();
    closeAuth();
  };

  const failValidation = (nextErrors: FieldErrors) => {
    setErrors(nextErrors);
    triggerErrorHaptic();
  };

  const handleLogin = async () => {
    const nextErrors: FieldErrors = {};
    if (!email.trim()) nextErrors.email = 'Enter your email.';
    else if (!EMAIL_REGEX.test(email.trim())) nextErrors.email = 'Enter a valid email address.';
    if (!password) nextErrors.password = 'Enter your password.';

    if (Object.keys(nextErrors).length > 0) {
      failValidation(nextErrors);
      return;
    }

    setLoading(true);
    const result = await login({ email, password });
    setLoading(false);

    if (!result.success) {
      setFormError(result.message || 'Could not log in. Please try again.');
      triggerErrorHaptic();
      return;
    }

    triggerSuccessHaptic();

    if (biometricAvailable && !biometricAsked) {
      showAlert({
        title: `Enable ${biometricLabel}?`,
        message: `Use ${biometricLabel} to unlock CASH next time instead of typing your password.`,
        type: 'info',
        icon: biometricIcon,
        buttons: [
          {
            text: 'Not now',
            style: 'cancel',
            onPress: () => {
              setBiometricEnabled(false);
            },
          },
          {
            text: 'Enable',
            onPress: async () => {
              const enabled = await setBiometricEnabled(true);
              if (!enabled) {
                showAlert({
                  title: 'Not Enabled',
                  message: `We could not verify your ${biometricLabel}. You can try again in Settings.`,
                  type: 'warning',
                });
              }
            },
          },
        ],
      });
    }
  };

  const handleRegister = async () => {
    const nextErrors: FieldErrors = {};
    if (name.trim().length < 2) nextErrors.name = 'Enter your name.';
    if (!email.trim()) nextErrors.email = 'Enter your email.';
    else if (!EMAIL_REGEX.test(email.trim())) nextErrors.email = 'Enter a valid email address.';
    if (!isPasswordValid(password)) {
      nextErrors.password = 'Password does not meet all the requirements.';
    }
    if (!confirm) nextErrors.confirm = 'Confirm your password.';
    else if (confirm !== password) nextErrors.confirm = 'Passwords do not match.';

    if (Object.keys(nextErrors).length > 0) {
      failValidation(nextErrors);
      return;
    }

    setLoading(true);
    const result = await register({ name, email, password });
    setLoading(false);

    if (!result.success) {
      setFormError(result.message || 'Could not create your account. Please try again.');
      triggerErrorHaptic();
      return;
    }

    triggerSuccessHaptic();
    showAlert({
      title: 'Account Created',
      message: 'Your account is ready. CASH will ask you to log in the next time you open the app.',
      type: 'success',
    });
  };

  const handleForgot = async () => {
    const nextErrors: FieldErrors = {};
    if (!email.trim()) nextErrors.email = 'Enter your email.';
    else if (!EMAIL_REGEX.test(email.trim())) nextErrors.email = 'Enter a valid email address.';

    if (Object.keys(nextErrors).length > 0) {
      failValidation(nextErrors);
      return;
    }

    setLoading(true);
    const result = await requestPasswordReset(email);
    setLoading(false);

    if (!result.success) {
      setFormError(result.message || 'Could not send the code. Please try again.');
      triggerErrorHaptic();
      return;
    }

    triggerSuccessHaptic();
    changeMode('reset');
  };

  const handleResend = async () => {
    triggerHaptic();
    setLoading(true);
    const result = await requestPasswordReset(email);
    setLoading(false);

    if (result.success) {
      showAlert({
        title: 'Code Sent',
        message: 'We sent a new 6-digit code to your email.',
        type: 'success',
      });
    } else {
      setFormError(result.message || 'Could not send the code. Please try again.');
    }
  };

  const handleReset = async () => {
    const nextErrors: FieldErrors = {};
    if (code.length !== 6) nextErrors.code = 'Enter the 6-digit code.';
    if (!isPasswordValid(password)) {
      nextErrors.password = 'Password does not meet all the requirements.';
    }
    if (!confirm) nextErrors.confirm = 'Confirm your new password.';
    else if (confirm !== password) nextErrors.confirm = 'Passwords do not match.';

    if (Object.keys(nextErrors).length > 0) {
      failValidation(nextErrors);
      return;
    }

    setLoading(true);
    const result = await resetPassword({ email, code, newPassword: password });
    setLoading(false);

    if (!result.success) {
      setFormError(result.message || 'Could not reset your password. Please try again.');
      triggerErrorHaptic();
      return;
    }

    triggerSuccessHaptic();
    changeMode('login');
    showAlert({
      title: 'Password Updated',
      message: 'Your password has been changed. Log in with your new password.',
      type: 'success',
    });
  };

  const copy = COPY[mode];
  const isRootMode = mode === 'login' || mode === 'register';
  const showBackButton = !(locked && mode === 'login');
  const useChevron = !isRootMode || (locked && mode === 'register');

  return (
    <>
      <StatusBar barStyle={colors.statusBar} />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          {showBackButton && (
            <TouchableOpacity
              style={styles.topBarButton}
              onPress={handleBack}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name={useChevron ? 'chevron-back' : 'close'}
                size={18}
                color={colors.text}
              />
            </TouchableOpacity>
          )}
        </View>

        <KeyboardAvoidingView style={styles.flex} behavior="padding">
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.header}>
              <Text style={styles.brand}>cash</Text>
              <Text style={styles.eyebrow}>{copy.eyebrow}</Text>
              <Text style={styles.title}>{copy.title}</Text>
              <Text style={styles.subtitle}>{copy.subtitle}</Text>
            </View>

            {mode === 'reset' && DEMO_MODE && (
              <View style={styles.infoBanner}>
                <Ionicons name="information-circle-outline" size={18} color={colors.textSecondary} />
                <Text style={styles.infoBannerText}>
                  Demo mode: no email is sent. Use the code{' '}
                  <Text style={styles.infoBannerCode}>{DEMO_RESET_CODE}</Text>.
                </Text>
              </View>
            )}

            {!!formError && (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle" size={18} color={colors.error} />
                <Text style={styles.errorBannerText}>{formError}</Text>
              </View>
            )}

            <View style={styles.form}>
              {mode === 'register' && (
                <AuthField
                  label="Name"
                  icon="person-outline"
                  placeholder="Your name"
                  value={name}
                  onChangeText={(text) => {
                    setName(text.replace(/\d/g, ''));
                    clearField('name');
                  }}
                  error={errors.name}
                  autoCapitalize="words"
                  autoComplete="name"
                  returnKeyType="next"
                  onSubmitEditing={() => emailRef.current?.focus()}
                  editable={!loading}
                />
              )}

              {mode !== 'reset' && (
                <AuthField
                  label="Email"
                  icon="mail-outline"
                  placeholder="you@email.com"
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    clearField('email');
                  }}
                  error={errors.email}
                  keyboardType="email-address"
                  autoComplete="email"
                  inputRef={emailRef}
                  returnKeyType={mode === 'forgot' ? 'send' : 'next'}
                  onSubmitEditing={() => {
                    if (mode === 'forgot') handleForgot();
                    else passwordRef.current?.focus();
                  }}
                  editable={!loading}
                />
              )}

              {mode === 'reset' && (
                <AuthField
                  label="6-Digit Code"
                  icon="keypad-outline"
                  placeholder="000000"
                  value={code}
                  onChangeText={(text) => {
                    setCode(text.replace(/\D/g, '').slice(0, 6));
                    clearField('code');
                  }}
                  error={errors.code}
                  keyboardType="number-pad"
                  maxLength={6}
                  code
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                  editable={!loading}
                />
              )}

              {mode !== 'forgot' && (
                <AuthField
                  label={mode === 'reset' ? 'New Password' : 'Password'}
                  icon="lock-closed-outline"
                  placeholder={mode === 'login' ? 'Your password' : 'Create a strong password'}
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    clearField('password');
                  }}
                  error={errors.password}
                  secure
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  inputRef={passwordRef}
                  returnKeyType={mode === 'login' ? 'go' : 'next'}
                  onSubmitEditing={() => {
                    if (mode === 'login') handleLogin();
                    else confirmRef.current?.focus();
                  }}
                  editable={!loading}
                />
              )}

              {(mode === 'register' || mode === 'reset') && (
                <>
                  <PasswordRules password={password} />
                  <AuthField
                    label="Confirm Password"
                    icon="shield-checkmark-outline"
                    placeholder="Repeat your password"
                    value={confirm}
                    onChangeText={(text) => {
                      setConfirm(text);
                      clearField('confirm');
                    }}
                    error={errors.confirm}
                    secure
                    autoComplete="new-password"
                    inputRef={confirmRef}
                    returnKeyType="go"
                    onSubmitEditing={mode === 'register' ? handleRegister : handleReset}
                    editable={!loading}
                  />
                </>
              )}

              {mode === 'login' && (
                <TouchableOpacity
                  style={styles.forgotLink}
                  onPress={() => switchMode('forgot')}
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.forgotLinkText}>Forgot password?</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.actions}>
              {mode === 'login' && (
                <AuthButton label="Log In" onPress={handleLogin} loading={loading} />
              )}
              {mode === 'register' && (
                <AuthButton label="Create Account" onPress={handleRegister} loading={loading} />
              )}
              {mode === 'forgot' && (
                <AuthButton label="Send Code" onPress={handleForgot} loading={loading} />
              )}
              {mode === 'reset' && (
                <AuthButton label="Reset Password" onPress={handleReset} loading={loading} />
              )}

              {isRootMode && !hasAccount && (
                <>
                  <View style={styles.dividerRow}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerText}>OR</Text>
                    <View style={styles.dividerLine} />
                  </View>
                  <AuthButton
                    label="Continue Without an Account"
                    variant="secondary"
                    onPress={handleSkip}
                    disabled={loading}
                  />
                </>
              )}
            </View>

            <View style={styles.footer}>
              {mode === 'login' && (
                <>
                  <Text style={styles.footerText}>Do not have an account?</Text>
                  <TouchableOpacity onPress={() => switchMode('register')} activeOpacity={0.7}>
                    <Text style={styles.footerLink}>Create one</Text>
                  </TouchableOpacity>
                </>
              )}
              {mode === 'register' && (
                <>
                  <Text style={styles.footerText}>Already have an account?</Text>
                  <TouchableOpacity onPress={() => switchMode('login')} activeOpacity={0.7}>
                    <Text style={styles.footerLink}>Log in</Text>
                  </TouchableOpacity>
                </>
              )}
              {mode === 'forgot' && (
                <>
                  <Text style={styles.footerText}>Remembered it?</Text>
                  <TouchableOpacity onPress={() => switchMode('login')} activeOpacity={0.7}>
                    <Text style={styles.footerLink}>Back to log in</Text>
                  </TouchableOpacity>
                </>
              )}
              {mode === 'reset' && (
                <>
                  <Text style={styles.footerText}>Did not get the code?</Text>
                  <TouchableOpacity onPress={handleResend} disabled={loading} activeOpacity={0.7}>
                    <Text style={styles.footerLink}>Resend</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}

export default function AuthScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { visible } = useAuth();
  const [anim] = useState(() => new Animated.Value(visible ? 1 : 0));
  const isFirstRun = useRef(true);

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      if (visible) return;
    }
    if (visible) {
      anim.setValue(0);
      Animated.timing(anim, {
        toValue: 1,
        duration: 340,
        easing: Easing.bezier(0.16, 1, 0.3, 1),
        useNativeDriver: true,
      }).start();
    } else {
      anim.setValue(0);
    }
  }, [visible, anim]);

  if (!visible) return null;

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [28, 0] });

  return (
    <Animated.View
      style={[styles.root, { opacity: anim, transform: [{ translateY }] }]}
      pointerEvents="auto"
    >
      <LinearGradient
        colors={[colors.backgroundGradientStart, colors.backgroundGradientEnd]}
        style={StyleSheet.absoluteFill}
      />
      <AuthForm />
    </Animated.View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: colors.background,
      zIndex: 100,
      elevation: 100,
    },
    safeArea: {
      flex: 1,
    },
    flex: {
      flex: 1,
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 22,
      paddingTop: 10,
      paddingBottom: 6,
      minHeight: 52,
    },
    topBarButton: {
      width: 36,
      height: 36,
      borderRadius: BORDER_RADIUS.full,
      backgroundColor: colors.cardBackground,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: 22,
      paddingTop: 16,
      paddingBottom: 32,
    },
    header: {
      marginBottom: 28,
    },
    brand: {
      fontFamily: FONTS.ndot || FONTS.system,
      fontSize: 15,
      color: colors.textSecondary,
      letterSpacing: 2,
      marginBottom: 22,
    },
    eyebrow: {
      fontFamily: FONTS.ndotCaps || FONTS.system,
      fontSize: 11,
      color: colors.textSecondary,
      letterSpacing: 1,
      marginBottom: 8,
    },
    title: {
      fontFamily: FONTS.ndot || FONTS.system,
      fontSize: 34,
      color: colors.text,
      letterSpacing: 1.5,
      marginBottom: 10,
    },
    subtitle: {
      fontFamily: FONTS.regular,
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 21,
    },
    infoBanner: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      padding: 14,
      marginBottom: 18,
      borderRadius: BORDER_RADIUS.md,
      backgroundColor: colors.cardBackground,
      borderWidth: 1,
      borderColor: colors.border,
    },
    infoBannerText: {
      flex: 1,
      fontFamily: FONTS.regular,
      fontSize: 12,
      color: colors.textSecondary,
      lineHeight: 18,
    },
    infoBannerCode: {
      fontFamily: FONTS.ndot || FONTS.system,
      fontSize: 13,
      color: colors.text,
      letterSpacing: 1,
    },
    errorBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 14,
      marginBottom: 18,
      borderRadius: BORDER_RADIUS.md,
      backgroundColor: hexToRgba(colors.error, 0.12),
      borderWidth: 1,
      borderColor: hexToRgba(colors.error, 0.5),
    },
    errorBannerText: {
      flex: 1,
      fontFamily: FONTS.medium,
      fontSize: 13,
      color: colors.error,
    },
    form: {
      gap: 4,
    },
    fieldBlock: {
      marginBottom: 12,
    },
    fieldLabel: {
      fontFamily: FONTS.medium,
      fontSize: 12,
      color: colors.textSecondary,
      marginBottom: 8,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    fieldContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: BORDER_RADIUS.md,
      paddingHorizontal: 14,
    },
    fieldContainerFocused: {
      borderColor: colors.primary,
    },
    fieldContainerError: {
      borderColor: colors.error,
    },
    fieldIcon: {
      marginRight: 10,
    },
    fieldInput: {
      flex: 1,
      paddingVertical: 14,
      color: colors.text,
      fontSize: 15,
      fontFamily: FONTS.regular,
    },
    fieldInputCode: {
      fontFamily: FONTS.ndot || FONTS.system,
      fontSize: 22,
      letterSpacing: 6,
    },
    fieldErrorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      marginTop: 6,
    },
    fieldErrorText: {
      flex: 1,
      fontFamily: FONTS.regular,
      fontSize: 12,
      color: colors.error,
    },
    rulesBox: {
      gap: 8,
      marginTop: 2,
      marginBottom: 16,
      padding: 14,
      borderRadius: BORDER_RADIUS.md,
      backgroundColor: colors.cardBackground,
      borderWidth: 1,
      borderColor: colors.border,
    },
    ruleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    ruleText: {
      fontFamily: FONTS.regular,
      fontSize: 12,
      color: colors.textMuted,
    },
    ruleTextMet: {
      color: colors.text,
    },
    forgotLink: {
      alignSelf: 'flex-end',
      marginTop: -2,
    },
    forgotLinkText: {
      fontFamily: FONTS.medium,
      fontSize: 13,
      color: colors.textSecondary,
    },
    actions: {
      marginTop: 24,
      gap: 14,
    },
    button: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      borderRadius: BORDER_RADIUS.md,
      minHeight: 50,
    },
    buttonPrimary: {
      backgroundColor: colors.primary,
    },
    buttonSecondary: {
      backgroundColor: colors.cardBackgroundLight,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    buttonPrimaryText: {
      fontFamily: FONTS.bold,
      fontSize: 15,
      color: colors.primaryText,
    },
    buttonSecondaryText: {
      fontFamily: FONTS.bold,
      fontSize: 14,
      color: colors.text,
    },
    dividerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: colors.border,
    },
    dividerText: {
      fontFamily: FONTS.ndotCaps || FONTS.system,
      fontSize: 10,
      color: colors.textMuted,
      letterSpacing: 1,
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      flexWrap: 'wrap',
      gap: 6,
      marginTop: 28,
    },
    footerText: {
      fontFamily: FONTS.regular,
      fontSize: 13,
      color: colors.textSecondary,
    },
    footerLink: {
      fontFamily: FONTS.bold,
      fontSize: 13,
      color: colors.text,
    },
  });
}