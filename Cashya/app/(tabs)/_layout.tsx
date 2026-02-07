import { Stack } from 'expo-router';
import { ExpensesProvider } from '../../contexts/ExpensesContext';

export default function RootLayout() {
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