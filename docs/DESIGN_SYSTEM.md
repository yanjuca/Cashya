# 🎨 Cashya Design System Specification

> Comprehensive Design Tokens, Component Blueprints, and Aesthetic Guidelines for **Cashya**. Inspired by **Nothing OS** and retro-futuristic dot-matrix minimalism.

---

## 📑 Table of Contents

1. [Design Philosophy & Aesthetic](#1-design-philosophy--aesthetic)
2. [Design Tokens & Values](#2-design-tokens--values)
   - [Color Palette](#color-palette)
   - [Typography & Fonts](#typography--fonts)
   - [Spacing Scale](#spacing-scale)
   - [Border Radii](#border-radii)
3. [Component Patterns & Blueprints](#3-component-patterns--blueprints)
   - [Surfaces & Elevated Cards](#surfaces--elevated-cards)
   - [Credit Card Item with Glowing Line](#credit-card-item-with-glowing-line)
   - [Status Dots & Micro-Indicators](#status-dots--micro-indicators)
   - [Form Inputs & Amount Fields](#form-inputs--amount-fields)
   - [Buttons & Haptics](#buttons--haptics)
   - [Custom Alert Modal](#custom-alert-modal)
   - [Floating Action Button (FAB)](#floating-action-button-fab)
4. [Iconography Standards](#4-iconography-standards)
5. [Anti-Hallucination & Coding Guardrails](#5-anti-hallucination--coding-guardrails)

---

## 1. Design Philosophy & Aesthetic

Cashya is designed around the **Nothing OS** visual language:
- **Pure OLED Darkness**: Backgrounds are `#000000`, optimizing battery life and providing stark contrast.
- **High-Voltage Red Accent**: `#ff453a` is used strategically for interactive calls to action, brand highlights, and pending expense warnings.
- **Dot-Matrix Retro-Futurism**: Typography features `Ndot57` for numbers, currency, dates, and badges, reminiscent of LED matrices.
- **Tactile Haptic Experience**: Every significant interaction (button presses, status toggles, card swipes) triggers crisp physical haptic feedback.
- **Pure Native StyleSheet**: No third-party UI component frameworks; standard React Native `StyleSheet` guarantees predictable performance and zero bloat.

---

## 2. Design Tokens & Values

All tokens are centralized in `theme.ts`:
```typescript
import { COLORS, FONTS, SPACING, BORDER_RADIUS, FONT_SIZES } from '@/theme';
```

### Color Palette

| Token | Hex / RGBA | Role / Application |
| :--- | :--- | :--- |
| `COLORS.background` | `#000000` | Pure black root background. |
| `COLORS.backgroundGradientStart` | `#140708` | Subtle dark red ambient tint for top gradients. |
| `COLORS.backgroundGradientEnd` | `#000000` | Gradient fade to pure black. |
| `COLORS.cardBackground` | `#18181c` / `#16161a` | Elevated surface for cards, input containers, modals. |
| `COLORS.cardBackgroundLight`| `#202026` | Second-layer elevated cards and chips. |
| `COLORS.primary` | `#ff453a` | Vibrant brand crimson red (FAB, active highlights). |
| `COLORS.primaryDark` | `#d32f2f` | Pressed / dimmed state for crimson elements. |
| `COLORS.primaryMuted` | `rgba(255, 69, 58, 0.15)` | Glowing halos and active card line shadows. |
| `COLORS.border` | `#24242a` / `#262630` | 1px border for cards, inputs, and modals. |
| `COLORS.borderLight` | `#32323a` | 1px border for tags and badges. |
| `COLORS.text` | `#ffffff` | Primary text, headers, currency values. |
| `COLORS.textSecondary` | `#8a8a93` / `#b0b0b8` | Field labels, captions, dates, cardholders. |
| `COLORS.textMuted` | `#55555c` / `#666672` | Placeholders, inactive icons, zero states. |
| `COLORS.success` | `#30d158` | Paid expense indicator, positive balance. |
| `COLORS.warning` | `#ffd60a` | Warning alerts and caution notices. |
| `COLORS.error` | `#ff453a` | Unpaid / Pending indicator, destructive buttons. |
| `COLORS.chip` | `#e5b842` | Accent chips. |
| `COLORS.badgeBackground` | `#1d1d22` / `#1d1d23` | Dark circular badge background. |

### Typography & Fonts

Custom fonts are loaded in `app/_layout.tsx` via `useFonts()`:

| Token | Family Name | Ideal Sizes | Purpose |
| :--- | :--- | :--- | :--- |
| `FONTS.ndot` | `Ndot57` | 15, 20, 23, 28 | Currency amounts, numbers, dates, app logo. Always pair with `letterSpacing: 1.0` - `1.5`. |
| `FONTS.ndotCaps` | `Ndot57Caps` | 11, 14, 18 | All-caps section headers (`TRANSACTIONS`, `EXPENSES`). |
| `FONTS.regular` | `DMSans_400Regular` | 13, 14, 15 | Descriptions, inputs, body text. |
| `FONTS.medium` | `DMSans_500Medium` | 11, 12, 13, 14 | Form labels, card types, participant names. |
| `FONTS.bold` | `DMSans_700Bold` | 13, 14, 16 | Action buttons, metric badges, strong emphasis. |

*Fallback pattern:*
```typescript
fontFamily: FONTS.ndot || FONTS.system,
```

### Spacing Scale

```typescript
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};
```

### Border Radii

```typescript
export const BORDER_RADIUS = {
  xs: 4,    // Badges, micro chips
  sm: 8,    // Tag pills
  md: 12,   // Inputs, action buttons
  lg: 16,   // Metric cards, expense list items
  xl: 20,   // Dialog cards, major containers
  xxl: 24,  // Bottom navigation bar, floating sheets
  full: 9999, // Circular FAB, status dots, round toggles
};
```

---

## 3. Component Patterns & Blueprints

### Surfaces & Elevated Cards
```typescript
const styles = StyleSheet.create({
  card: {
    backgroundColor: '#16161a',
    borderRadius: BORDER_RADIUS.lg, // 16
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#24242a',
  },
});
```

### Credit Card Item with Glowing Line
The active card in `CreditCardItem.tsx` features an unmistakable Nothing OS glowing vertical accent line:
```typescript
const styles = StyleSheet.create({
  glowLine: {
    position: 'absolute',
    left: 0,
    top: 10,
    bottom: 10,
    width: 3.5,
    borderRadius: 2,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    zIndex: 2,
  },
});
```

### Status Dots & Micro-Indicators
Every expense item displays payment status via a 7px circular dot:
```typescript
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
    backgroundColor: COLORS.error,   // #ff453a
  },
});
```

### Form Inputs & Amount Fields
```typescript
const styles = StyleSheet.create({
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardBackground,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: 14,
  },
  currencySymbol: {
    fontFamily: FONTS.ndot || FONTS.system,
    fontSize: 20,
    color: COLORS.primary,
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    paddingVertical: 14,
    color: COLORS.text,
    fontSize: 18,
    fontFamily: FONTS.ndot || FONTS.system,
  },
});
```

### Buttons & Haptics
- **Confirm / Inverted Action**: High-contrast white background (`#ffffff`) with black bold text (`#000000`).
- **Primary Accent Action**: Crimson red (`COLORS.primary`) with white text.
- **Cancel / Outline Action**: Charcoal background (`#1b1b22`) with subtle border (`#2e2e38`).
- **Destructive Action**: Crimson red (`COLORS.primary`) with warning haptic.

```typescript
if (Platform.OS !== 'web') {
  try {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {}
}
```

### Custom Alert Modal
Native `Alert.alert` is strictly prohibited. Use the centralized `useAlert()` hook:
```typescript
import { useAlert } from '../contexts/AlertContext';

const { showAlert } = useAlert();

showAlert({
  title: 'Delete Expense',
  message: 'Are you sure you want to permanently remove this transaction?',
  type: 'danger',
  buttons: [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: handleDelete },
  ],
});
```

### Floating Action Button (FAB)
- 56x56 circular container (`BORDER_RADIUS.full`).
- Background: `COLORS.primary` (`#ff453a`).
- Border: `1px solid rgba(255, 255, 255, 0.2)`.
- Icon: `Ionicons name="add" size={30} color="#ffffff"`.
- Trigger: `Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)`.

---

## 4. Iconography Standards

- **Icon Family**: `@expo/vector-icons`, specifically `Ionicons` and `MaterialIcons`.
- **States**:
  - Inactive / Outline: `name="wallet-outline"`, `name="pie-chart-outline"`, `name="settings-outline"`.
  - Active / Solid: `name="wallet"`, `name="pie-chart"`, `name="settings"`.
- **Icon Sizing**:
  - Tab Bar Icons: `size={20}` or `22`.
  - Action / Tool Icons: `size={24}`.
  - Large / FAB Icons: `size={30}`.

---

## 5. Anti-Hallucination & Coding Guardrails

1. ❌ **Never install UI component frameworks**: No React Native Paper, NativeBase, Tamagui, or Tailwind.
2. ❌ **Never use light mode colors**: Background is always OLED `#000000`.
3. ❌ **Never hardcode hex values**: Always import from `theme.ts`.
4. ❌ **Never use native `Alert.alert()`**: Use `useAlert()`.
5. ❌ **Never use unauthorized fonts**: Use `FONTS.ndot`, `FONTS.ndotCaps`, or `FONTS.regular / medium / bold`.
6. ❌ **Never make external API calls**: Cashya is 100% offline-first (`AsyncStorage`).
