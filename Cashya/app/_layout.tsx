import { LinearGradient } from 'expo-linear-gradient';
import { Stack } from 'expo-router';
import { ActivityIndicator } from 'react-native';
import { ExpensesProvider } from '../contexts/ExpensesContext';
import { useFonts } from '../hooks/useFonts';
import { COLORS } from '../theme';

export default function RootLayout() {
  const fontsLoaded = useFonts();

  if (!fontsLoaded) {
    return (
      <LinearGradient
        colors={[COLORS.backgroundGradientStart, COLORS.backgroundGradientEnd]}
        style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
      >
        <ActivityIndicator size="large" color={COLORS.primary} />
      </LinearGradient>
    );
  }

  return (
    <ExpensesProvider>
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="index" />
      </Stack>
    </ExpensesProvider>
  );
}