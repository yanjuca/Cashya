import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans';
import { useFonts as useExpoFonts } from 'expo-font';

export function useFonts() {
  const [fontsLoaded] = useExpoFonts({
    'Ndot57': require('../assets/fonts/Ndot57-Regular.otf'),
    'Ndot57Caps': require('../assets/fonts/Ndot57Caps-Regular.otf'),
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
  });

  return fontsLoaded;
}