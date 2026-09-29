# Cashya — Rules & Guidelines for AI Agents

Welcome to **Cashya**, a personal and shared expense tracking mobile application built with **React Native (0.86)**, **Expo (SDK 57)**, and **TypeScript**.

To preserve architectural integrity and avoid visual or technical hallucinations, **ALL agents and LLM pair programmers MUST strictly obey the rules below**.

---

## 🚫 Critical Anti-Hallucination Guardrails

1. **NO Third-Party UI Kits / CSS Frameworks**:
   - ❌ DO NOT install or import NativeBase, React Native Paper, Tailwind / NativeWind, Tamagui, gluestack, or styled-components.
   - ✅ ALWAYS use standard React Native `StyleSheet.create({ ... })`.

2. **NO Hardcoded Colors or Random Palettes**:
   - ❌ NEVER use Tailwind blues (`#3b82f6`), emeralds (`#10b981`), purples, or random hex codes.
   - ✅ ALWAYS import and use tokens from `theme.ts`:
     ```typescript
     import { COLORS, FONTS, SPACING, BORDER_RADIUS, FONT_SIZES } from '@/theme'; // or relative path
     ```
   - Cashya is exclusively **OLED Dark Mode**. There is NO light mode.

3. **NO Native `Alert.alert(...)`**:
   - ❌ NEVER use React Native's default `Alert.alert()`. It breaks the Nothing OS aesthetic.
   - ✅ ALWAYS use the custom modal system via the `useAlert()` hook:
     ```typescript
     import { useAlert } from '../contexts/AlertContext';
     const { showAlert } = useAlert();
     showAlert({ title: 'Success', message: 'Item saved', type: 'success' });
     ```

4. **NO Cloud Backends or Remote Network Calls for Financial Data**:
   - ❌ Cashya is **100% offline-first**. DO NOT add Supabase, Firebase, AWS, or REST endpoints for financial records.
   - ✅ ALL persistence is managed through `services/storage.ts` using `@react-native-async-storage/async-storage`.

5. **NO Unregistered Custom Fonts**:
   - ❌ DO NOT use Roboto, Inter, Helvetica, Arial, or San Francisco directly.
   - ✅ ONLY use font families defined in `FONTS` (`theme.ts`):
     - `FONTS.ndot` (`'Ndot57'`): Dot-matrix numbers, currency amounts (`$ 150.00`), dates, brand logo.
     - `FONTS.ndotCaps` (`'Ndot57Caps'`): Dot-matrix uppercase section titles (`TRANSACTIONS`, `MY CARDS`).
     - `FONTS.regular` (`'DMSans_400Regular'`): Body copy, inputs, descriptions.
     - `FONTS.medium` (`'DMSans_500Medium'`): Subtitles, card labels, participant names, buttons.
     - `FONTS.bold` (`'DMSans_700Bold'`): High-emphasis badges, button labels.
   - Always provide fallback when using dot fonts: `fontFamily: FONTS.ndot || FONTS.system`.

---

## 🎨 Visual Identity & Nothing OS Aesthetic

Cashya is heavily inspired by the **Nothing OS** design language:
- **Canvas**: Pure OLED Black (`#000000`).
- **Elevated Surfaces**: Dark charcoal cards (`#16161a` / `#18181c`) with subtle borders (`#24242a` / `#262630`) and 1px width.
- **Accents**: High-voltage crimson red (`#ff453a`).
- **Status Indicators (7px circular dots)**:
  - 🔴 Pending / Unsettled: `COLORS.error` (`#ff453a`).
  - 🟢 Paid / Settled: `COLORS.success` (`#30d158`).
  - 🟡 Warning / Caution: `COLORS.warning` (`#ffd60a`).
- **Haptic Feedback**:
  - Use `expo-haptics` for interactive actions (taps, status toggles, modal confirms).
  - Always guard with `Platform.OS !== 'web'` and `try/catch`.

---

## 📐 Token Reference (`theme.ts`)

| Category | Token | Value | Recommended Usage |
| :--- | :--- | :--- | :--- |
| **Colors** | `COLORS.background` | `#000000` | Screen root background |
| | `COLORS.cardBackground` | `#18181c` | Cards, input containers, modal boxes |
| | `COLORS.cardBackgroundLight`| `#202026` | Tag chips, nested elements |
| | `COLORS.primary` | `#ff453a` | FAB, primary buttons, glowing accent lines |
| | `COLORS.border` | `#24242a` | Card & input boundaries (1px) |
| | `COLORS.borderLight` | `#32323a` | Tag and chip boundaries |
| | `COLORS.text` | `#ffffff` | Primary headings, values, user input |
| | `COLORS.textSecondary` | `#8a8a93` | Field labels, captions, dates |
| | `COLORS.textMuted` | `#55555c` | Placeholders, inactive icons |
| | `COLORS.success` | `#30d158` | Paid status, positive balances |
| | `COLORS.warning` | `#ffd60a` | Attention warnings |
| | `COLORS.error` | `#ff453a` | Unpaid status, destructive buttons |
| **Radii** | `BORDER_RADIUS.sm` | `8` | Tags, small badges |
| | `BORDER_RADIUS.md` | `12` | Inputs, secondary buttons |
| | `BORDER_RADIUS.lg` | `16` | Standard cards, metric containers |
| | `BORDER_RADIUS.xl` | `20` | Modals, prominent dialog cards |
| | `BORDER_RADIUS.full`| `9999` | Circular FAB, pill chips, status dots |

---

## 🧩 Component Blueprint Checklist

When building or modifying components:

1. **Card Container**:
   ```typescript
   container: {
     backgroundColor: '#16161a',
     borderRadius: BORDER_RADIUS.lg,
     paddingHorizontal: 16,
     paddingVertical: 12,
     borderWidth: 1,
     borderColor: '#24242a',
   }
   ```

2. **Text Hierarchy**:
   - Section Title: `fontFamily: FONTS.ndotCaps || FONTS.system`, `fontSize: 11-13`, `letterSpacing: 1`, `color: COLORS.textSecondary`.
   - Numeric Value: `fontFamily: FONTS.ndot || FONTS.system`, `fontSize: 20-28`, `letterSpacing: 1.2`, `color: '#ffffff'`.
   - Body / Description: `fontFamily: FONTS.regular`, `fontSize: 14`, `color: COLORS.text`.
   - Input Label: `fontFamily: FONTS.medium`, `fontSize: 12-13`, `color: COLORS.textSecondary`.

3. **Buttons**:
   - **Primary Action (Nothing Inverted)**: White background (`#ffffff`), black text (`#000000`), `fontFamily: FONTS.bold`.
   - **Primary Action (Brand Accent)**: Red background (`COLORS.primary`), white text (`#ffffff`), `fontFamily: FONTS.bold`.
   - **Secondary / Cancel**: Charcoal background (`#1b1b22`), border (`#2e2e38`), muted text (`#a0a0ab`).
   - **Destructive**: `COLORS.primary`, white text.

4. **Icons**:
   - Use `@expo/vector-icons` (prefer `Ionicons` or `MaterialIcons`).
   - Active state: Filled glyphs (e.g. `wallet`, `swap-horizontal`, `settings`).
   - Inactive state: Outline glyphs (e.g. `wallet-outline`, `swap-horizontal-outline`, `settings-outline`).
