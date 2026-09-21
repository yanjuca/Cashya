# Cashya Architectural Guide

> Official technical documentation detailing architecture, data flow, code standards, and developer onboarding.

---

## 📑 Table of Contents

1. [Overview & Core Principles](#1-overview--core-principles)
2. [Architectural Decision: Pragmatic Modular vs. Strict FSD](#2-architectural-decision-pragmatic-modular-vs-strict-fsd)
3. [Layer Overview & Architecture Diagram](#3-layer-overview--architecture-diagram)
4. [Project Structure & Responsibilities](#4-project-structure--responsibilities)
5. [Navigation & Routing (Expo Router)](#5-navigation--routing-expo-router)
6. [Design System & Nothing OS Aesthetic](#6-design-system--nothing-os-aesthetic)
7. [State Management & Local Persistence](#7-state-management--local-persistence)
8. [Backup & Restore System](#8-backup--restore-system)
9. [Developer Guide (Onboarding & Contribution)](#9-developer-guide-onboarding--contribution)

---

## 1. Overview & Core Principles

**Cashya** is a personal and shared expense tracking mobile application built with **React Native**, **Expo (SDK 57)**, and **TypeScript**.

### Core Non-Negotiable Principles:
- 🔒 **100% Offline-First & Privacy**: No user financial data is sent across the internet or relies on third-party servers. All persistence is local to the device via `AsyncStorage`.
- ⚡ **Zero Friction**: The app requires no login, sign-up, email verification, or passwords. Launch the app and use it immediately.
- 🎨 **Nothing OS Aesthetic**: Pure OLED deep black (`#000000`), dark surfaces with subtle borders (`#24242a`), custom dot-matrix typography (`Ndot57`), and crimson red accents (`#ff453a`).
- 👥 **Shared Tracking**: Clear tracking of who is responsible for each expense (`person`) and settlement status (`paid`).

---

## 2. Architectural Decision: Pragmatic Modular vs. Strict FSD

We opted for a **Domain-Oriented Pragmatic Modular Architecture (Feature-Based)** rather than strict FSD (Feature-Sliced Design).

### Why NOT strict FSD for Cashya?
- **Friction with Expo Router**: Expo Router dictates a file-based routing convention in `app/`. Overlaying strict FSD layers (`pages`, `widgets`, `features`, `entities`, `shared`) produces conceptual duplication and dozens of empty or single-file folders.
- **Boilerplate Overhead**: Strict FSD demands dozens of barrel files (`index.ts`) and deep directory segmentations that slow down code navigation for a lean, fast app.
- **Pragmatism**: We adopted the best principles of FSD — **domain boundary isolation, centralized strict typing, and decoupled services** — without bureaucratic mini-layer overhead.

---

## 3. Layer Overview & Architecture Diagram

```mermaid
flowchart TD
    subgraph UI_Presentation [Presentation Layer]
        RootLayout[app/_layout.tsx - Root Provider & Fonts] --> TabsLayout[app/(tabs)/_layout.tsx - 4 Tabs Layout]
        TabsLayout --> TabHome[Home: WalletHomeScreen]
        TabsLayout --> TabTransactions[Transactions: TransactionsScreen]
        TabsLayout --> TabStats[Analytics: StatisticsTabScreen]
        TabsLayout --> TabSettings[Settings: SettingsScreen]
        
        TabHome -.-> FABHome((FAB +))
        TabTransactions -.-> FABTrans((FAB +))
        FABHome --> ModalAdd[AddExpenseScreen]
        FABTrans --> ModalAdd
        TabHome --> ModalEdit[EditExpenseScreen]
        TabTransactions --> ModalEdit
    end

    subgraph State_Layer [State Management / Contexts]
        ExpensesContext[ExpensesContext.tsx]
        CardsContext[CardsContext.tsx]
    end

    subgraph Domain_Types [Domain Layer & Contracts]
        Types[types/index.ts - Expense, CreditCard, BackupData]
    end

    subgraph Service_Layer [Service Layer & I/O]
        StorageService[services/storage.ts]
        BackupService[services/backup.ts]
        Formatters[utils/formatters.ts]
        Theme[theme.ts - Design Tokens]
    end

    subgraph Local_Storage [Local Storage]
        AsyncStorage[AsyncStorage Local-First]
    end

    TabHome --> ExpensesContext
    TabHome --> CardsContext
    TabTransactions --> ExpensesContext
    TabStats --> ExpensesContext
    TabSettings --> ExpensesContext
    TabSettings --> CardsContext
    TabSettings --> BackupService

    ExpensesContext --> Types
    CardsContext --> Types
    ExpensesContext --> StorageService
    CardsContext --> StorageService
    BackupService --> StorageService
    BackupService --> Types
    StorageService --> AsyncStorage
```

---

## 4. Project Structure & Responsibilities

```
Cashya/
├── app/                              # Routing Layer (Expo Router v6)
│   ├── (tabs)/                       # Main application tabs
│   │   ├── _layout.tsx               # Bottom tab bar (Nothing OS style)
│   │   ├── index.tsx                 # Route: Home (Wallet & Cards)
│   │   ├── transactions.tsx          # Route: Transactions (List + Calendar)
│   │   ├── statistics.tsx            # Route: Analytics & Reports
│   │   └── settings.tsx              # Route: Settings, Backup & Card Management
│   └── _layout.tsx                   # Root layout, font loading & global providers
│
├── assets/                           # Static assets
│   ├── fonts/                        # Custom fonts (Ndot57-Regular, Ndot57Caps-Regular)
│   └── images/                       # App icons, splash screens, and image assets
│
├── components/                       # React Native UI Components
│   ├── cards/                        # Card domain components
│   │   ├── CardsCarousel.tsx         # Horizontal snapping cards carousel with pagination
│   │   └── CreditCardItem.tsx        # Individual card item with Nothing OS glowing line
│   ├── dashboard/                    # Metric components
│   │   └── MetricCard.tsx            # Full and compact metric cards
│   ├── screens/                      # Complete integrated screens
│   │   ├── WalletHomeScreen.tsx      # Financial dashboard & active card transactions
│   │   ├── TransactionsScreen.tsx    # Unified transactions with List ↔ Calendar toggle
│   │   ├── CalendarView.tsx          # Dot-matrix monthly grid with glowing indicator dots
│   │   ├── StatisticsTabScreen.tsx   # Analytics dashboard, tag ranking, and charts
│   │   ├── SettingsScreen.tsx        # Settings, card wallet management, and backup
│   │   ├── AddExpenseScreen.tsx      # Modal for adding a new expense
│   │   └── EditExpenseScreen.tsx     # Modal for editing and deleting expenses
│   └── ui/                           # Shared atomic UI components
│       └── FAB.tsx                   # Floating Action Button (+) with haptics
│
├── contexts/                         # Global State Management (React Context)
│   ├── ExpensesContext.tsx           # Expense state (CRUD, paid toggle, reload)
│   └── CardsContext.tsx              # Card wallet state (active card, limits)
│
├── services/                         # Infrastructure & I/O Services
│   ├── storage.ts                    # Strongly-typed AsyncStorage wrapper
│   └── backup.ts                     # Native JSON export and safe restore
│
├── types/                            # Central TypeScript Type Contracts
│   └── index.ts                      # Expense, CreditCard, CardBrand, CardType, BackupData
│
├── utils/                            # Pure Utility Functions
│   └── formatters.ts                 # Currency ($), en-US dates, and key generation
│
├── theme.ts                          # Design Tokens (Colors, Typography, Spacing, Radius)
├── app.json                          # Expo configuration and native metadata
├── eas.json                          # Expo Application Services build profiles
└── tsconfig.json                     # Strict TypeScript compiler options
```

---

## 5. Navigation & Routing (Expo Router)

The application follows a **4 Main Tabs + Action Modals** pattern:

| Tab | Route | Component | Responsibility |
| :--- | :--- | :--- | :--- |
| **Home** | `/` | `app/(tabs)/index.tsx` | Card carousel, available limits, and recent transactions. |
| **Transactions** | `/transactions` | `app/(tabs)/transactions.tsx` | Unified ledger with top toggle between **List Mode** (search + person/tag/status filters) and **Calendar Mode** (monthly dot-matrix grid). |
| **Analytics** | `/statistics` | `app/(tabs)/statistics.tsx` | Analytical metrics, spending by person, most used categories, and 6-month historical trend. |
| **Settings** | `/settings` | `app/(tabs)/settings.tsx` | Card wallet management, JSON backup export/restore, and storage stats. |

### Floating Action Button (FAB):
- Rendered on `Home` and `Transactions` screens.
- Positioned above the tab bar with a crimson accent (`#ff453a`).
- Triggers the `AddExpenseScreen` modal with gentle haptic feedback (`Haptics.impactAsync`).

---

## 6. Design System & Nothing OS Aesthetic

All design tokens are centralized in `theme.ts`.

### 🎨 Color Palette
- **Primary Background**: `#000000` (Pure OLED black for maximum contrast and battery efficiency).
- **Background Gradient**: Starts at `#140708` (subtle dark red tint) and ends at `#000000`.
- **Primary Accent**: `#ff453a` (Vibrant Nothing OS red).
- **Card Surfaces**: `#16161a` with subtle borders in `#24242a`.
- **Status Dots**:
  - `Red (#ff453a)`: Pending expense / alert.
  - `Green (#30d158)`: Paid / settled expense.
  - `Yellow (#ffd60a)`: Warning.

### 🔤 Typography
- `Ndot57`: Used for numbers, currency amounts (`$ 150.00`), dates, and the app brand logo.
- `Ndot57Caps`: Used for uppercase section headers (`TRANSACTIONS`, `MY CARDS`).
- `System`: Native device font for descriptions and text inputs for optimal readability.

---

## 7. State Management & Local Persistence

### Core Data Models (`types/index.ts`)
```typescript
export interface Expense {
  id: string;
  description: string;
  amount: number;
  person: string;
  date: Date;
  tags: string[];
  paid: boolean;
  source?: 'manual' | 'notification' | 'import';
  cardId?: string;
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

### Contexts:
- **`ExpensesContext`**: Manages the reactive in-memory expense list and synchronizes with `StorageService` on all mutations (`addExpense`, `editExpense`, `removeExpense`, `togglePaid`).
- **`CardsContext`**: Manages registered cards, currently active card in the carousel (`activeCard`), and recalculates available limits in real time.

---

## 8. Backup & Restore System

As Cashya is **100% offline-first**, user data security relies on a simple, universal backup routine.

- **Export (`BackupService.shareBackup`)**:
  - Consolidates all expenses and cards into a versioned JSON payload.
  - Triggers the native system share sheet (`Share.share`), allowing users to send their backup to WhatsApp, Google Drive, email, or local files.
- **Restore (`BackupService.restoreFromJson`)**:
  - Accepts backup JSON, validates structural integrity, sanitizes dates and numerical fields, and reloads contexts in memory instantly.

---

## 9. Developer Guide (Onboarding & Contribution)

### Prerequisites
- **Node.js**: v18 or higher.
- **npm** or **yarn**.
- **Expo Go** mobile app (Android / iOS).

### Essential Commands

```bash
# Install dependencies
npm install

# Start Expo Metro Bundler development server
npx expo start

# Strict TypeScript type verification
npx tsc --noEmit

# Lint code quality and standards
npm run lint
```

### Adding a New Feature (Standard Workflow)
1. **Define Types**: If introducing new entities or properties, declare them in `types/index.ts`.
2. **Services**: If involving persistence or I/O, implement methods in `services/storage.ts`.
3. **Context**: Expose state and action handlers in the relevant context (`contexts/`).
4. **UI**: Build or extend screens in `components/screens/` using design tokens from `theme.ts`.
5. **Validation**: Always run `npx tsc --noEmit` and `npm run lint` before submitting changes.
