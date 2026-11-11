import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';

const BIOMETRIC_PREF_KEY = '@cashya:biometric_pref';

export type BiometricPreference = 'enabled' | 'disabled' | null;

export interface BiometricInfo {
  available: boolean;
  label: string;
  icon: 'finger-print' | 'scan-outline';
}

export const NO_BIOMETRICS: BiometricInfo = {
  available: false,
  label: 'Biometrics',
  icon: 'finger-print',
};

export const BiometricService = {
  async getInfo(): Promise<BiometricInfo> {
    if (Platform.OS === 'web') return NO_BIOMETRICS;
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const enrolled = hasHardware && (await LocalAuthentication.isEnrolledAsync());
      if (!enrolled) return NO_BIOMETRICS;

      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
      const hasFace = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
      const hasFinger = types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT);

      if (Platform.OS === 'ios') {
        if (hasFace) return { available: true, label: 'Face ID', icon: 'scan-outline' };
        if (hasFinger) return { available: true, label: 'Touch ID', icon: 'finger-print' };
      } else {
        if (hasFinger) return { available: true, label: 'Fingerprint', icon: 'finger-print' };
        if (hasFace) return { available: true, label: 'Face Unlock', icon: 'scan-outline' };
      }
      return { available: true, label: 'Biometrics', icon: 'finger-print' };
    } catch (error) {
      console.error('Error checking biometrics:', error);
      return NO_BIOMETRICS;
    }
  },

  async authenticate(promptMessage: string): Promise<boolean> {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage,
        cancelLabel: 'Use password',
        disableDeviceFallback: true,
      });
      return result.success;
    } catch (error) {
      console.error('Error during biometric authentication:', error);
      return false;
    }
  },

  async getPreference(): Promise<BiometricPreference> {
    try {
      const value = await AsyncStorage.getItem(BIOMETRIC_PREF_KEY);
      return value === 'enabled' || value === 'disabled' ? value : null;
    } catch {
      return null;
    }
  },

  async setPreference(value: Exclude<BiometricPreference, null>): Promise<void> {
    try {
      await AsyncStorage.setItem(BIOMETRIC_PREF_KEY, value);
    } catch (error) {
      console.error('Error saving biometric preference:', error);
    }
  },

  async clearPreference(): Promise<void> {
    try {
      await AsyncStorage.removeItem(BIOMETRIC_PREF_KEY);
    } catch (error) {
      console.error('Error clearing biometric preference:', error);
    }
  },
};