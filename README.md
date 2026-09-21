<div align="center">

# `cashya`

**Personal and shared expense tracking with minimalist, retro-futuristic design and focus on simplicity.**

[![Expo](https://img.shields.io/badge/Expo-SDK%2057-000020?style=for-the-badge&logo=expo&logoColor=white)](https://expo.dev)
[![React Native](https://img.shields.io/badge/React_Native-0.86-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactnative.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Expo Router](https://img.shields.io/badge/Expo%20Router-v6-000?style=for-the-badge&logo=expo&logoColor=white)](https://docs.expo.dev/router/introduction/)
[![Platforms](https://img.shields.io/badge/Platforms-Android%20%7C%20iOS%20%7C%20Web-E95420?style=for-the-badge)](https://expo.dev)

</div>

---

## 📑 Table of Contents

- [Overview](#-overview)
- [Highlights & Features](#-highlights--features)
- [Tab Navigation & Screens](#-tab-navigation--screens)
- [Architecture & Technical Documentation](#-architecture--technical-documentation)
- [Design & Visual Identity](#-design--visual-identity)
- [Project Structure](#-project-structure)
- [Data Models](#-data-models)
- [Getting Started](#-getting-started)
- [Available Scripts](#-available-scripts)
- [Build & Deployment (EAS)](#-build--deployment-eas)
- [License & Credits](#-license--credits)

---

## 💡 Overview

**Cashya** is a personal and shared expense tracking mobile application built with **React Native** and **Expo SDK 57**. It was designed to solve bill splitting and expense management with zero clutter, zero required cloud accounts, and zero friction.

Inspired by the retro-futuristic, minimalist aesthetics of systems like **Nothing OS** (featuring the custom dot-matrix typography `Ndot57`), the application blends visual elegance with high-speed performance and a pure **offline-first** architecture.

---

## ✨ Highlights & Features

- 🔒 **100% Offline-First & Privacy**: All information is stored locally on your device via `AsyncStorage`. Your financial data never leaves your device without your explicit action.
- ⚡ **Zero Friction**: Open the app and use it immediately — no sign-up forms, no passwords, no mandatory network connectivity.
- 🎨 **Nothing OS Aesthetic (Dot-Matrix & Dark Mode)**: Pure OLED black background (`#000000`), dark cards with subtle borders (`#24242a`), vibrant red accents (`#ff453a`), and custom `Ndot57` fonts.
- 💳 **Card & Limit Management**: Track credit limits, available balance, and spent totals per card.
- 👥 **Smart Split & Shared Expenses**: Effortlessly keep track of who owes what and who has already settled payments.
- 💾 **Local Backup & Restore**: Export and restore your complete dataset natively via JSON files at any time.

---

## 🚀 Tab Navigation & Screens

The app is structured into **4 main navigation tabs + Floating Action Button (FAB)**:

### 1. 💳 Home (`WalletHomeScreen`)
- Cards Carousel (`CardsCarousel`) supporting multiple cards (Credit & Debit).
- Limit Insights: Available limit, Total spent, Pending and Paid balances.
- Recent transactions list linked to the active card.

### 2. 🔄 Transactions (`TransactionsScreen`)
- **Quick Header Switcher**: Seamlessly toggle between **List Mode** and **Calendar Mode**.
- **List Mode**:
  - Real-time description search bar.
  - Multi-filter chips: Status (All, Pending, Paid), Person, and Tags.
  - Quick tap to edit; long press to toggle status (Pending / Paid).
- **Calendar Mode**:
  - Monthly navigation with automatic month total and pending calculations.
  - Dot-matrix calendar grid with glowing status dots (red for pending, green for paid).
  - Tap any date to filter day-specific expenses.

### 3. 📊 Analytics (`StatisticsTabScreen`)
- Core metrics: Total recorded, percentage paid vs pending, and average ticket.
- **Breakdown by Person**: See who paid the most and how much each participant owes.
- **Breakdown by Category**: Ranking of most frequent tags with relative spending percentages.
- **Last 6 Months Trend**: Proportional monthly spending comparison chart.

### 4. ⚙️ Settings & Backup (`SettingsScreen`)
- **Card Wallet Manager**: Add new cards with holder name, limit, brand, and expiration, or remove existing ones.
- **Backup & Restore**:
  - **Export Backup**: Generates and shares a versioned JSON backup via the native system share sheet.
  - **Restore Backup**: Validates and imports JSON backup data, reloading the app state instantly.
- **Reset Database**: Safe option to clear test data and restore defaults.

### ➕ Floating Action Button (FAB)
- Floating `(+)` button on Home and Transactions screens with Nothing OS styling and smooth haptic feedback (`expo-haptics`) to add expenses in seconds.

---

## 📐 Architecture & Technical Documentation

Cashya uses a **Pragmatic Feature-Based Modular Architecture**, combining clear separation of concerns with TypeScript strict typing and agile development.

> 📖 **Check out the technical documentation**:  
> 👉 [**Frontend Architecture Guide**](docs/ARCHITECTURE.md)  
> 👉 [**Backend & API Specification Guide**](docs/BACKEND_SPEC.md)

---

## 📁 Project Structure

```
Cashya/
├── app/                              # Expo Router v6 file-based routes
│   ├── (tabs)/                       # Tab navigation routes
│   │   ├── _layout.tsx               # Nothing OS styled bottom tab bar
│   │   ├── index.tsx                 # Tab 1: Home (Wallet & Cards)
│   │   ├── transactions.tsx          # Tab 2: Transactions (List + Calendar)
│   │   ├── statistics.tsx            # Tab 3: Analytics & Reports
│   │   └── settings.tsx              # Tab 4: Settings, Cards & Backup
│   └── _layout.tsx                   # Root stack layout, font loading & providers
│
├── assets/                           # Static assets
│   ├── fonts/                        # Ndot57 and Ndot57Caps custom fonts
│   └── images/                       # App icons and splash screen
│
├── components/                       # React Native UI components
│   ├── cards/                        # CardsCarousel and CreditCardItem
│   ├── dashboard/                    # MetricCard
│   ├── screens/                      # WalletHome, Transactions, StatisticsTab, Settings...
│   └── ui/                           # FAB (+), CalendarView
│
├── contexts/                         # Global state management (Context API)
│   ├── ExpensesContext.tsx           # Expenses state & CRUD
│   └── CardsContext.tsx              # Card wallet state & limits
│
├── services/                         # Infrastructure & I/O
│   ├── storage.ts                    # Typed AsyncStorage wrapper
│   └── backup.ts                     # Native JSON export & import
│
├── types/                            # Centralized domain types & contracts
│   └── index.ts                      # Expense, CreditCard, BackupData...
│
├── utils/                            # Pure formatting utilities
│   └── formatters.ts                 # Currency ($), dates, and key generation
│
├── theme.ts                          # Design System Tokens (Colors, Fonts, Spacing)
├── docs/                             # Technical documentation
│   └── ARCHITECTURE.md               # Complete architecture guide
├── app.json                          # Expo configuration
├── package.json                      # Project dependencies & scripts
└── tsconfig.json                     # TypeScript strict configuration
```

---

## 📦 Data Models

Core data contracts are defined in `types/index.ts`:

```typescript
export interface Expense {
  id: string;          // Unique identifier
  description: string; // Expense description
  amount: number;      // Monetary amount (e.g., 150.50)
  person: string;      // Responsible person / participant
  date: Date;          // Date the expense occurred
  tags: string[];      // Categorization tags (e.g., ["Rent", "Home"])
  paid: boolean;       // Settlement indicator (true / false)
  source?: 'manual' | 'notification' | 'import';
  cardId?: string;     // Associated card ID
}

export interface CreditCard {
  id: string;
  holderName: string;
  brand: 'visa' | 'mastercard' | 'elo' | 'generic';
  type: 'Credit' | 'Debit';
  lastDigits: string;
  expiryDate: string;
  limit: number;
  colorAccent?: string;
}
```

---

## 🏁 Getting Started

### Prerequisites
- [**Node.js**](https://nodejs.org/) (v18 or higher)
- Package manager: **npm** or **yarn**
- [**Expo Go**](https://expo.dev/go) app installed on your physical smartphone (Android or iOS).

### Installation

```bash
git clone https://github.com/yanjuca/Cashya.git
cd Cashya
npm install
```

### Running the App

```bash
npx expo start
```

In the terminal or open web interface:
- **Physical Device**: Open Expo Go and scan the terminal **QR Code**.
- **Android Emulator**: Press <kbd>a</kbd> in the terminal.
- **iOS Simulator**: Press <kbd>i</kbd> in the terminal (macOS only).
- **Web Browser**: Press <kbd>w</kbd> in the terminal.

---

## 📜 Available Scripts

| Command | Description |
| :--- | :--- |
| `npm start` | Starts the Expo Metro Bundler development server |
| `npm run android` | Runs the app directly on a connected Android device or emulator |
| `npm run ios` | Runs the app on the iOS simulator (macOS) |
| `npm run web` | Runs the app in the web browser |
| `npm run lint` | Runs ESLint to validate code quality and best practices |
| `npx tsc --noEmit` | Runs strict TypeScript type-checking |

---

## 🏗️ Build & Deployment (EAS)

The project includes [EAS Build](https://docs.expo.dev/build/introduction/) configuration in `eas.json`.

```bash
# Preview build (Standalone APK for Android)
eas build -p android --profile preview

# Production build
eas build -p android --profile production
```

---

## 📄 License & Credits

Developed with care by [Yan Juca](https://github.com/yanjuca).  
Distributed under the **MIT** License.

<div align="center">
  <sub>Built with ❤️, React Native, and Expo.</sub>
</div>
