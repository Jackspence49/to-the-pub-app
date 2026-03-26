# To The Pub App

A React Native mobile app for discovering bars and pub events near your location.

## Tech Stack

- **Framework**: React Native + Expo (v54) with file-based routing via Expo Router
- **Language**: TypeScript (strict mode)
- **Navigation**: Expo Router with tab navigator and dynamic routes
- **Styling**: Theme-aware components with light/dark mode support (`constants/theme.ts`)
- **Icons**: Lucide React Native + Expo Vector Icons
- **Location**: Expo Location with permission handling and TTL caching
- **Auth**: Context API + Expo Secure Store for token persistence
- **API**: REST via `EXPO_PUBLIC_API_URL` env variable

## Commands

```bash
npm start          # Start Expo dev server
npm run android    # Run on Android emulator
npm run ios        # Run on iOS simulator
npm run web        # Run in browser
npm run lint       # Run ESLint
```

## Project Structure

```
app/                  # File-based routes (Expo Router)
  (tabs)/             # Tab screens: index (Open Bars), events, search
  bar/[barId].tsx     # Bar detail
  event/[instanceId].tsx  # Event detail
  login.tsx / register.tsx
components/           # Reusable UI components
hooks/                # Custom hooks (useBars, useTagFilters, UseLocationCache, use-auth)
utils/                # Helpers, constants, mappers, time formatters
types/index.ts        # All shared TypeScript types
constants/theme.ts    # Light/dark color palette
```

## Key Patterns

**Authentication**: `use-auth` hook wraps the app in an `AuthProvider`. Three states: `'checking'`, `'authenticated'`, `'unauthenticated'`. Tokens stored in Expo Secure Store.

**Data Fetching**: `useBars` hook handles pagination, in-memory caching (5min TTL), and concurrent request limiting. API responses may have multiple formats — `Barmappers.ts` normalises them.

**Location**: `UseLocationCache` manages GPS with a 5-min cache and graceful permission denial. Falls back to Boston coords `(42.3555, -71.0565)`.

**Theming**: All components receive theme colours dynamically via `useColorScheme()`. Avoid hardcoded colours — use values from `constants/theme.ts`.

**Routing**: Grouped routes use parentheses `(tabs)`, dynamic routes use brackets `[barId]`. Typed routes experiment is enabled in `tsconfig.json`.

## Environment Variables

| Variable | Purpose |
|---|---|
| `EXPO_PUBLIC_API_URL` | Base URL for all API requests |
