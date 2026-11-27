import { LinearGradient } from 'expo-linear-gradient';
import { Stack } from 'expo-router';
import { ActivityIndicator, Platform, UIManager } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AuthScreen from '../components/auth/AuthScreen';
import OnboardingScreen from '../components/onboarding/OnboardingScreen';
import { AlertProvider } from '../contexts/AlertContext';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { CardsProvider } from '../contexts/CardsContext';
import { ExpensesProvider } from '../contexts/ExpensesContext';
import { LanguageProvider } from '../contexts/LanguageContext';
import { OnboardingProvider } from '../contexts/OnboardingContext';
import { ThemeProvider } from '../contexts/ThemeContext';
import { useFonts } from '../hooks/useFonts';
import { COLORS } from '../theme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function SplashScreen() {
  return (
    <LinearGradient
      colors={[COLORS.backgroundGradientStart, COLORS.backgroundGradientEnd]}
      style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
    >
      <ActivityIndicator size="large" color={COLORS.primary} />
    </LinearGradient>
  );
}

function AppShell() {
  const { isReady } = useAuth();

  if (!isReady) {
    return <SplashScreen />;
  }

  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="(tabs)" />
      </Stack>
      <OnboardingScreen />
      <AuthScreen />
    </>
  );
}

export default function RootLayout() {
  const fontsLoaded = useFonts();

  if (!fontsLoaded) {
    return <SplashScreen />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <LanguageProvider>
        <ThemeProvider>
          <AlertProvider>
            <AuthProvider>
              <ExpensesProvider>
                <CardsProvider>
                  <OnboardingProvider>
                    <AppShell />
                  </OnboardingProvider>
                </CardsProvider>
              </ExpensesProvider>
            </AuthProvider>
          </AlertProvider>
        </ThemeProvider>
      </LanguageProvider>
    </GestureHandlerRootView>
  );
}