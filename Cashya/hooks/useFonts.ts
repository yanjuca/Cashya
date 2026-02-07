import { useFonts as useExpoFonts } from 'expo-font';

export function useFonts() {
  const [fontsLoaded] = useExpoFonts({
    'Ndot57': require('../assets/fonts/Ndot57-Regular.otf'),
    'Ndot57Caps': require('../assets/fonts/Ndot57Caps-Regular.otf'),
  });

  return fontsLoaded;
}