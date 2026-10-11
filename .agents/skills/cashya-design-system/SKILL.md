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

## 4. Language & Copy Standards (Strict English UI)

All user-facing copy in Cashya must be strictly in **English**:
- **UI Labels & Section Headers**:
  - Dot-matrix uppercase titles: `TRANSACTIONS`, `FURTHER INSIGHTS`, `MY CARDS`, `BACKUP & RESTORE (OFFLINE-FIRST)`.
  - Spec sheet labels: `RESPONSIBLE`, `FULL DATE`, `METHOD / CARD`, `RECORD SOURCE`, `ATTACHED TAGS`.
- **Status Badges & Actions**:
  - Status indicators: `PAID` (green `#30d158`), `PENDING` / `UNPAID` (red `#ff453a`).
  - Toggle buttons: `MARK AS PAID`, `MARK AS UNPAID`.
- **Metrics & Insight Labels**:
  - `MONTH SHARE`, `LIMIT USAGE`, `HISTORY`, `First time`, `Records`, `Available limit`, `Total spent`.
- **Dates & Locales**:
  - ALWAYS use `'en-US'` for date and number formatting (e.g. `toLocaleDateString('en-US', ...)`).
  - NEVER format dates with `'pt-BR'`.
- **Modals, Forms & Alerts**:
  - Form placeholders, input labels (`Cardholder Name`, `Who should pay / Responsible`), modal headers, and custom alerts (`useAlert()`) must always be written in English.

---

## 5. UI Recipes & Code Patterns

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

### Recipe E: Standard Bottom-Sheet Modal Pattern (`AddCardModal` / `AddExpenseScreen` pattern)
All modals in Cashya follow the same bottom-sheet dialog archetype:
```typescript
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { BORDER_RADIUS, COLORS, FONTS } from '@/theme';

export function StandardModalSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalBackdrop}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>MODAL TITLE</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#ffffff" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Modal Body / Inputs */}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#16161a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#24242a',
    maxHeight: '88%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: FONTS.ndot || FONTS.system,
    color: '#ffffff',
    letterSpacing: 1,
  },
  inputLabel: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 8,
    marginTop: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalInput: {
    fontFamily: FONTS.regular,
    backgroundColor: '#0e0e12',
    borderWidth: 1,
    borderColor: '#2a2a32',
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#ffffff',
    fontSize: 15,
  },
  pillRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  pillOption: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: BORDER_RADIUS.sm,
    backgroundColor: '#0e0e12',
    borderWidth: 1,
    borderColor: '#2a2a32',
  },
  pillOptionActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  modalSaveButton: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 20,
  },
  modalSaveButtonText: {
    fontFamily: FONTS.bold,
    color: '#ffffff',
    fontSize: 15,
  },
});
```

### Recipe F: Dock-Coupled Batch Edit Mode (Expanding Bottom Dock Pattern)
Batch action bar is coupled directly to the bottom floating navigation dock (`app/(tabs)/_layout.tsx`):
- When normal: Dock is `64px` height, housing 4 tabs (`Home`, `Transactions`, `Analytics`, `Settings`).
- When in Edit Mode: Dock expands with spring physics (`tension: 65, friction: 11`) to `118px` height:
  - **Upper Tier (`52px`)**:
    - Left: Circular `✕` button (`#22222a`, `size: 28`) to exit edit mode + `${count} SELECTED` in `FONTS.ndotCaps` (`letterSpacing: 1`, `color: #ffffff`).
    - Right: Destructive delete pill (`COLORS.primary`, `trash-outline` icon + `DELETE` label in `FONTS.bold`).
  - **Divider**: Hairline `1px` (`#262630`) dividing the edit tier and the tabs.
  - **Lower Tier (`64px`)**: Navigation tabs row.
- In screens (`WalletHomeScreen`, `TransactionsScreen`): No top floating bars. ScrollViews use `paddingBottom: 140-150` so cards are never obscured.

---

## 6. Anti-Hallucination Checklist

Before finalizing any UI implementation, verify:
- [ ] Strictly English UI: all user-facing copy, headers, button labels, form placeholders, status pills (`PAID`/`PENDING`), dialog messages, and dates (`en-US`) are strictly in English (NO Portuguese strings).
- [ ] No external UI kit imported (`NativeBase`, `Paper`, `Tamagui`, `NativeWind`).
- [ ] All colors imported from `theme.ts` (`COLORS.*`), no random hex codes.
- [ ] No light mode styles or white screen backgrounds.
- [ ] Dot-matrix fonts (`Ndot57`) used strictly for numbers, amounts, dates, and titles.
- [ ] Regular/Medium/Bold DM Sans used for body, labels, and forms.
- [ ] Cards have `1px` border (`#24242a` or `COLORS.border`) and `BORDER_RADIUS.lg` (16).
- [ ] Modals follow Recipe E (`StandardModalSheet` pattern: slide animation, #16161a, 24px top radius, #24242a border, close icon).
- [ ] Empty states use minimal dotted glyphs (`reorder-two-outline` in `#22222a`) without cluttered body copy.
- [ ] Alerts use `useAlert()` (`CustomAlertModal.tsx`), NEVER `Alert.alert(...)`.
- [ ] Navigation controls & dropdowns prefer dot-matrix / typographic glyphs (`‹`, `›`, `▲`, `▼`).
- [ ] Icons use `@expo/vector-icons` (`Ionicons`).
- [ ] Haptic feedback properly guarded with `Platform.OS !== 'web'` and `try/catch`.
- [ ] Type integrity validated with `npx tsc --noEmit`.
