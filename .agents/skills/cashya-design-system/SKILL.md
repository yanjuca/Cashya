---
name: cashya-design-system
description: >-
  Use this skill whenever creating, modifying, styling, or reviewing UI components, screens, modals, or visual elements in Cashya to adhere strictly to the Nothing OS aesthetic and design system tokens.
---

# Cashya Design System & UI Skill

This skill guides the construction and maintenance of user interfaces in **Cashya**, ensuring 100% adherence to its signature **Nothing OS / Retro-Futuristic OLED Dark** aesthetic and preventing visual deviations or hallucinations.

---

## 1. Quick Token Import

Every UI component in Cashya must import and use tokens from `theme.ts`:

```typescript
import { BORDER_RADIUS, COLORS, FONT_SIZES, FONTS, SPACING } from '../../theme';
```

---

## 2. Core Visual Rules & Palette

| Token / Element | Exact Value | Usage & Rules |
| :--- | :--- | :--- |
| `COLORS.background` | `#000000` | Pure OLED black for all root containers. |
| `COLORS.backgroundGradientStart` | `#140708` | Subtle top-to-bottom dark crimson gradient glow. |
| `COLORS.cardBackground` | `#18181c` | Standard cards, input backgrounds, modal surfaces. |
| `COLORS.cardBackgroundLight` | `#202026` | Elevated cards, chip tags, secondary panels. |
| `COLORS.border` | `#24242a` | 1px border for cards, inputs, and dividers. |
| `COLORS.borderLight` | `#32323a` | 1px border for chips, tags, and secondary containers. |
| `COLORS.primary` | `#ff453a` | High-voltage crimson accent (Nothing OS red). |
| `COLORS.primaryMuted` | `rgba(255, 69, 58, 0.15)` | Glowing halos, background pills for active items. |
| `COLORS.text` | `#ffffff` | Primary text, titles, numeric amounts. |
| `COLORS.textSecondary` | `#8a8a93` | Metadata, subtitles, input labels, dates. |
| `COLORS.textMuted` | `#55555c` | Placeholders, inactive icons, empty states. |
| `COLORS.success` | `#30d158` | Paid status indicator dot, positive metrics. |
| `COLORS.warning` | `#ffd60a` | Pending warnings, cautionary badges. |
| `COLORS.error` | `#ff453a` | Unpaid / Pending status indicator dot, destructive actions. |

---

## 3. Typography Rules

Cashya uses two distinct font families:
1. **Dot-Matrix (`Ndot57` / `Ndot57Caps`)**:
   - `FONTS.ndot` (`'Ndot57'`): Used for currency amounts (`$ 240.00`), numerical values, dates in dot matrix, and branding.
   - `FONTS.ndotCaps` (`'Ndot57Caps'`): Used for uppercase section headers (`TRANSACTIONS`, `LIMIT INSIGHTS`).
   - *Safe Fallback*: Always pair dot fonts with `|| FONTS.system` (e.g. `fontFamily: FONTS.ndot || FONTS.system`).
   - *Letter Spacing*: Add `letterSpacing: 1` or `1.5` to dot-matrix text for authentic retro-futuristic spacing.

2. **Sans-Serif (`DM Sans`)**:
   - `FONTS.regular` (`'DMSans_400Regular'`): Body text, transaction descriptions, user inputs.
   - `FONTS.medium` (`'DMSans_500Medium'`): Subtitles, labels, participant names, tab bar labels.
   - `FONTS.bold` (`'DMSans_700Bold'`): Buttons, badge text, emphasized highlights.

---

## 4. UI Recipes & Code Patterns

### Recipe A: Standard Elevated Card (`MetricCard` / `ExpenseItem` pattern)
```typescript
import { StyleSheet, Text, View } from 'react-native';
import { BORDER_RADIUS, COLORS, FONTS } from '@/theme';

export function CustomInfoCard({ title, value }: { title: string; value: string }) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#16161a',
    borderRadius: BORDER_RADIUS.lg, // 16
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#24242a',
  },
  title: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  value: {
    fontFamily: FONTS.ndot || FONTS.system,
    fontSize: 22,
    color: '#ffffff',
    letterSpacing: 1.2,
  },
});
```

### Recipe B: Form Input Field
```typescript
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { BORDER_RADIUS, COLORS, FONTS } from '@/theme';

export function FormField({ label, value, onChangeText, placeholder }: any) {
  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textMuted}
        selectionColor={COLORS.primary}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    marginBottom: 16,
  },
  label: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 6,
  },
  input: {
    fontFamily: FONTS.regular,
    backgroundColor: COLORS.cardBackground,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md, // 12
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: COLORS.text,
    fontSize: 15,
  },
});
```

### Recipe C: Status Indicator Dot
```typescript
// 7px circular glowing indicator
const styles = StyleSheet.create({
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: BORDER_RADIUS.full,
  },
  statusPaid: {
    backgroundColor: COLORS.success, // #30d158
  },
  statusPending: {
    backgroundColor: COLORS.error, // #ff453a
  },
});
```

### Recipe D: Haptic-Enabled Button
```typescript
import * as Haptics from 'expo-haptics';
import { Platform, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { BORDER_RADIUS, COLORS, FONTS } from '@/theme';

export function ActionButton({ label, onPress, variant = 'primary' }: any) {
  const handlePress = () => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
    }
    onPress();
  };

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      style={[styles.button, variant === 'confirm' ? styles.confirm : styles.primary]}
      onPress={handlePress}
    >
      <Text style={[styles.text, variant === 'confirm' ? styles.confirmText : styles.primaryText]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 48,
    borderRadius: BORDER_RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  primary: {
    backgroundColor: COLORS.primary, // #ff453a
  },
  primaryText: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    color: '#ffffff',
  },
  confirm: {
    backgroundColor: '#ffffff', // Nothing OS high-contrast inverted button
  },
  confirmText: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    color: '#000000',
  },
});
```

---

## 5. Anti-Hallucination Checklist

Before finalizing any UI implementation, verify:
- [ ] No external UI kit imported (`NativeBase`, `Paper`, `Tamagui`, `NativeWind`).
- [ ] All colors imported from `theme.ts` (`COLORS.*`), no random hex codes.
- [ ] No light mode styles or white screen backgrounds.
- [ ] Dot-matrix fonts (`Ndot57`) used strictly for numbers, amounts, dates, and titles.
- [ ] Regular/Medium/Bold DM Sans used for body, labels, and forms.
- [ ] Cards have `1px` border (`#24242a` or `COLORS.border`) and `BORDER_RADIUS.lg` (16).
- [ ] Alerts use `useAlert()` (`CustomAlertModal.tsx`), NEVER `Alert.alert(...)`.
- [ ] Icons use `@expo/vector-icons` (`Ionicons`).
- [ ] Haptic feedback properly guarded with `Platform.OS !== 'web'` and `try/catch`.
- [ ] Type integrity validated with `npx tsc --noEmit`.
