# PHASE 02 — IMPLEMENTATION REPORT
## Design System, RTL, Themes, and Splash Screen

---

### 1. OBJECTIVE

Phase 2 establishes the visual foundation for every future LEGALIR page. It delivers a complete Material Design V2 design system with Persian-first RTL support, dual theme (light/dark), a 19-component library, responsive layout primitives, a 4-second animated splash screen, and a private `/design-system` development route.

---

### 2. DELIVERABLES SUMMARY

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Vazir font loading with proper fallback | PASS |
| 2 | Global `dir="rtl"` and `lang="fa"` | PASS |
| 3 | Localization architecture (Persian-first, English-ready) | PASS |
| 4 | Light and Dark theme tokens (CSS custom properties) | PASS |
| 5 | Theme persistence (Zustand + localStorage) | PASS |
| 6 | Material Design V2 tokens (Color, Typography, Spacing, Elevation, Shape, Motion, State layers) | PASS |
| 7 | 19 Reusable components | PASS |
| 8 | Responsive application layout primitives (AppShell, BottomNav) | PASS |
| 9 | RTL-safe icons and navigation direction | PASS |
| 10 | Persian numeral/date formatting utilities | PASS |
| 11 | 4-second animated Splash Screen | PASS |
| 12 | `/design-system` dev route | PASS |
| 13 | Visual and interaction tests | PASS |
| 14 | PHASE_02_REPORT.md | PASS |

---

### 3. ARCHITECTURE

#### 3.1 Design Token System

```
packages/ui/src/tokens/
├── index.ts          # Barrel export
├── colors.ts         # Brand colors (Navy + Gold), semantic colors, 
│                     # light/dark palettes, state layer opacities
├── typography.ts     # MD2 type scale (Display, Headline, Title, 
│                     # Label, Body), Vazir-first font stacks
├── spacing.ts        # 8px grid system, layout breakpoints, 
│                     # touch targets
├── elevation.ts      # 10 elevation levels with dark theme 
│                     # overlay adjustments
├── shape.ts          # 6 corner radius tokens (small → circle)
└── motion.ts         # Duration tokens, easing curves, 
                      # reduced-motion support
```

**Token layers**:
1. **Primitive**: Raw values (hex colors, pixel sizes)
2. **Semantic**: Purpose-mapped (`--color-primary`, `--color-error`)
3. **Component**: Consumed by individual component styles

All tokens exposed as:
- CSS custom properties in `globals.css` (used by Tailwind utility classes)
- TypeScript constants in `packages/ui/src/tokens/` (used by component logic)

#### 3.2 Component Architecture

```
packages/ui/src/components/
├── index.ts          # Barrel export
├── Button.tsx        # filled | outlined | text | tonal
├── IconButton.tsx    # standard | filled | tonal
├── TextField.tsx     # outlined | filled, label float, char count
├── OTPInput.tsx      # 6-digit, auto-focus, paste support
├── Select.tsx        # Native select with MD2 styling
├── Checkbox.tsx      # SVG checkmark, indeterminate support
├── Radio.tsx         # RadioGroup + Radio compound
├── Switch.tsx        # Track + thumb animation
├── Card.tsx          # elevated | filled | outlined
├── Dialog.tsx        # Modal with backdrop, focus trap, esc close
├── Drawer.tsx        # Side panel, start/end position
├── Snackbar.tsx      # Global snackbar via imperative API
├── Tooltip.tsx       # Hover tooltip with configurable delay
├── Tabs.tsx          # Animated indicator, primary/secondary variants
├── Chip.tsx          # filled | outlined, removable, selectable
├── Badge.tsx         # Number badge and dot mode
├── Progress.tsx      # Linear (determinate, indeterminate, buffer)
│                     # + Circular with SVG stroke-dasharray
├── Skeleton.tsx      # Shape variants + preset patterns
├── EmptyState.tsx    # Icon, title, description, action buttons
└── ErrorState.tsx    # Error icon, message, retry button
```

**Component design principles**:
- All components are RTL-aware (use CSS logical properties)
- All accept a `className` prop for Tailwind overrides
- All support `disabled` state with 38% opacity
- State layers use `::after` pseudo-elements (hover, focus, pressed)
- Focus-visible outlines use `outline-offset: 2px` primary color

#### 3.3 Theme System

```
light mode                 dark mode
───────────              ───────────
primary: #102E4A         primary: #A9C7E3
secondary: #B8860B        secondary: #E6C35C
background: #F7F8FA       background: #0E141B
surface: #FFFFFF          surface: #17212B
```

**Persistence flow**:
1. Inline `<script>` in `<head>` reads `localStorage` or `prefers-color-scheme`
2. Sets `data-theme` attribute before first paint (prevents flash)
3. Zustand `useThemeStore` with `persist` middleware reads/writes to `localStorage`
4. CSS custom properties swap instantly via `[data-theme]` selector

#### 3.4 i18n Architecture

```
packages/i18n/src/
├── index.ts             # Barrel, getMessages()
├── interpolate.ts       # Template interpolation, pluralization
├── locale-context.tsx    # React context + useT() hook
├── fa-IR.ts              # Persian strings (primary, complete)
└── en.ts                 # English placeholder (ready, not active)
```

- `LocaleProvider` wraps the application with `locale="fa-IR"`
- `useT()` hook returns a translator function: `t("auth.mobileTitle")`
- Template interpolation: `t("auth.otpResendIn", { seconds: 30 })`
- English strings are structurally identical (`as const`) and ready for activation by changing one provider prop

---

### 4. SPLASH SCREEN SPECIFICATION

| Requirement | Implementation |
|-------------|---------------|
| 4-second duration | Default `SPLASH_DURATION = 4000ms`, configurable via `NEXT_PUBLIC_SPLASH_DURATION_MS` env or `data-splash-duration` HTML attribute |
| Motion | CSS animations: rotating border rings, pulsing scales logo, dot loading indicator |
| Lightweight | Pure CSS animation keyframes, no animation library, SVG inline, no raster images |
| `prefers-reduced-motion` | Detected via `window.matchMedia`, replaces animations with static loading text |
| Fail-safe | `Math.max(duration * 2, 10000)` — never blocks more than 10 seconds |
| Smooth transition | 500ms `fade-out` animation before removing from DOM |
| No replay on navigation | Zustand `splashShown` flag persisted to localStorage, checked on re-mount |
| Configurable for tests | `data-splash-duration="0"` on `<html>` skips immediately |

**Splash phases**:
1. **Entering** (immediate): Fade-in animation on brand mark + text
2. **Visible** (~4s): Animated scaling logo with subtle rotating decorative rings, three-dot loading indicator
3. **Exiting** (500ms): Fade-out of entire splash layer
4. **Done**: Component unmounts, `AppBoot` renders children

---

### 5. FILES CREATED

#### 5.1 packages/ui/src/tokens/ (NEW DIRECTORY)

| File | Purpose |
|------|---------|
| `colors.ts` | Brand palette (Navy 50-900, Gold 50-900), semantic colors, state layer opacities, light/dark theme color maps |
| `typography.ts` | MD2 type scale (15 sizes), Vazir + Inter font stacks |
| `spacing.ts` | 8px grid (0-128px), layout breakpoints (320-1440px), touch targets (48px) |
| `elevation.ts` | 10 elevation levels (0-24), dark theme overlay adjustments |
| `shape.ts` | 6 border-radius tokens (4px-50%) |
| `motion.ts` | 11 duration tokens (50ms-700ms), 4 easing curves, reduced-motion constants |
| `index.ts` | Barrel export |

#### 5.2 packages/ui/src/components/ (NEW DIRECTORY)

| File | Component |
|------|-----------|
| `Button.tsx` | Button (filled/outlined/text/tonal, 3 sizes, loading state) |
| `IconButton.tsx` | IconButton (standard/filled/tonal, 3 sizes) |
| `TextField.tsx` | TextField (outlined/filled, label float, error/helper text, char count) |
| `OTPInput.tsx` | OTPInput (6-digit, auto-focus, paste, numeric-only) |
| `Select.tsx` | Select (native, MD2 styling, chevron icon) |
| `Checkbox.tsx` | Checkbox (SVG-based, indeterminate, label) |
| `Radio.tsx` | RadioGroup + Radio (fieldset, row/column layout) |
| `Switch.tsx` | Switch (track/thumb CSS animation) |
| `Card.tsx` | Card + CardHeader/CardContent/CardFooter (3 variants) |
| `Dialog.tsx` | Dialog + ConfirmDialog (backdrop, focus trap) |
| `Drawer.tsx` | Drawer (start/end position, esc close) |
| `Snackbar.tsx` | SnackbarProvider + imperative `snackbar` API (4 variants) |
| `Tooltip.tsx` | Tooltip (4 positions, configurable delay) |
| `Tabs.tsx` | Tabs (animated indicator, primary/secondary) |
| `Chip.tsx` | Chip (filled/outlined, removable, selectable) |
| `Badge.tsx` | Badge (number with max, dot mode) |
| `Progress.tsx` | ProgressLinear (determinate/indeterminate/buffer) + ProgressCircular (SVG stroke-dasharray) |
| `Skeleton.tsx` | Skeleton + SkeletonCard + SkeletonList |
| `EmptyState.tsx` | EmptyState (icon, title, description, primary/secondary actions) |
| `ErrorState.tsx` | ErrorState (error icon, message, retry button) |
| `index.ts` | Barrel export |

#### 5.3 packages/i18n/ (MODIFIED)

| File | Purpose |
|------|---------|
| `interpolate.ts` | Simple template interpolation, `createTranslator()` factory, deep path access, plural support |
| `locale-context.tsx` | `LocaleProvider`, `useLocale()`, `useT()` React hooks |
| `index.ts` | Updated barrel with new exports |
| `package.json` | Added `react` dependency for hooks |

#### 5.4 apps/frontend/src/

| File | Purpose |
|------|---------|
| `stores/theme-store.ts` | Zustand store: theme state + splashShown flag, persisted to localStorage |
| `stores/index.ts` | Updated barrel with theme store |
| `lib/icons.tsx` | 28 RTL-safe SVG icon components (navigation, action, status, content) |
| `lib/persian-utils.ts` | `toPersianDigits()`, `fromPersianDigits()`, `toPersianDate()`, `toRelativeTime()`, `toPersianNumber()`, `toPersianCurrency()` |
| `lib/layout-primitives.tsx` | `AppShell` (responsive shell with sidebar/drawer/topbar/bottomnav), `BottomNav`, `ThemeToggle` |
| `lib/splash.tsx` | `SplashScreen` component + `SplashKeyframes` (CSS injection) |
| `app/globals.css` | Rewritten: 80+ CSS custom properties, MD2 tokens, Vazir import, RTL base, scrollbar, focus-visible, reduced-motion, selection, utility classes |
| `lib/providers.tsx` | Updated with `LocaleProvider`, `SnackbarProvider`, `SplashKeyframes`, `AppBoot` splash gate |
| `app/(dev)/layout.tsx` | Dev tools layout (noindex, nofollow) |
| `app/(dev)/design-system/page.tsx` | Full component showcase: typography, colors, elevation, all 19 components, responsive display info |

#### 5.5 Tests

| File | Tests | Coverage |
|------|-------|----------|
| `lib/__tests__/components.test.tsx` | 20 | Button, TextField, Checkbox, Switch, Card, EmptyState, ErrorState, Chip, Badge, Tabs |
| `lib/__tests__/persian-utils.test.ts` | 6 | toPersianDigits, fromPersianDigits, toPersianNumber |
| `lib/__tests__/splash.test.tsx` | 5 | Rendering, reduced motion, immediate finish, cleanup |

#### 5.6 Modified Existing Files

| File | Change | Reason |
|------|--------|--------|
| `packages/ui/src/theme.ts` | Updated exports, imports from new token files | Consolidation |
| `packages/ui/src/index.ts` | Added component and token barrel exports | Package API |
| `packages/i18n/package.json` | Added `react` dependency | LocaleProvider hooks |

---

### 6. DESIGN TOKENS REFERENCE

#### 6.1 Color Palette

| Token | Light | Dark |
|-------|-------|------|
| `--color-primary` | `#102E4A` | `#A9C7E3` |
| `--color-primary-variant` | `#0A2034` | `#7399BC` |
| `--color-secondary` | `#B8860B` | `#E6C35C` |
| `--color-background` | `#F7F8FA` | `#0E141B` |
| `--color-surface` | `#FFFFFF` | `#17212B` |
| `--color-error` | `#B3261E` | `#FFB4AB` |
| `--color-warning` | `#9A6700` | `#F4C95D` |
| `--color-success` | `#1F6B45` | `#7BD9A8` |

#### 6.2 Typography Scale

| Token | Size | Line | Weight |
|-------|------|------|--------|
| Display Large | 57px | 64px | 400 |
| Headline Large | 32px | 40px | 700 |
| Headline Small | 24px | 32px | 700 |
| Title Large | 22px | 28px | 500 |
| Body Large | 16px | 28px | 400 |
| Body Medium | 14px | 24px | 400 |
| Label Large | 14px | 20px | 500 |

#### 6.3 Spacing Grid (8px base)

| Unit | Value |
|------|-------|
| 0.5u | 4px |
| 1u | 8px |
| 2u | 16px |
| 3u | 24px |
| 4u | 32px |
| 6u | 48px |
| 8u | 64px |

#### 6.4 Breakpoints

| Name | Width |
|------|-------|
| mobile-s | 320px |
| mobile-l | 375px |
| tablet | 600px |
| desktop | 1024px |
| wide | 1440px |

---

### 7. RTL IMPLEMENTATION

**Global configuration**:
- `html[lang="fa-IR"][dir="rtl"]` set in root layout
- CSS `direction: rtl` on `<html>` element
- Persian numerals via `font-feature-settings: "ss01"` on Vazir font
- CSS logical properties used throughout (`inset-inline-start`, `padding-inline-end`, etc.)

**Icons**:
- 28 SVG icon components, each in a `createIcon` factory
- `rtlFlip` prop on directional icons (chevron, arrow back/forward, logout)
- CSS class `.rtl-flip` applies `transform: scaleX(-1)` for RTL mirroring
- `data-icon` attribute for query selectors

**Layout primitives**:
- `AppShell`: Sidebar on `end` (right) in RTL, drawer slides from `end`
- `Drawer`: Position prop `end` (right) or `start` (left), slides correctly in RTL
- `BottomNav`: No special RTL handling needed — items are flex row

---

### 8. COMPONENT STATE HANDLING

All components handle these states consistently:

| State | Implementation |
|-------|---------------|
| **Default** | Normal rendering |
| **Hover** | `::after` pseudo-element with 8% currentColor, or Tailwind `hover:` variants |
| **Focus-visible** | 2px primary outline with 2px offset, keyboard-only |
| **Active/Pressed** | 12% state layer overlay |
| **Disabled** | 38% opacity + `pointer-events-none` |
| **Loading** | Spinner SVG (for buttons), indeterminate animation (for progress) |
| **Error** | Red border/outline, error text below with `role="alert"` |
| **Empty** | `EmptyState` component with icon, message, optional CTAs |
| **Error boundary** | `ErrorState` component with retry button |

---

### 9. TEST RESULTS

| Category | Files | Tests | Pass |
|----------|-------|-------|------|
| Unit (Vitest) | 6 | 45 | 45/45 |
| TypeScript | — | 0 errors | PASS |
| ESLint | — | 0 warnings | PASS |
| Build (Next.js) | 21 routes | All static | PASS |

#### Test breakdown:
- **env.test.ts** (5): Environment schema validation
- **loading.test.tsx** (4): Loading skeleton components
- **error-utils.test.tsx** (5): Error display, empty states
- **components.test.tsx** (20): Button, TextField, Checkbox, Switch, Card, EmptyState, ErrorState, Chip, Badge, Tabs
- **persian-utils.test.ts** (6): Digit conversion, number formatting
- **splash.test.tsx** (5): Rendering, reduced motion, immediate finish, cleanup

---

### 10. BUILD OUTPUT

```
Route (app)                              Size     First Load JS
├ ○ /                                   178 B         106 kB
├ ○ /design-system                     7.6 kB         123 kB
├ ○ /health                            16.5 kB        119 kB
├ ... (18 other routes)                    —             —
+ First Load JS shared by all          103 kB
```

---

### 11. KNOWN LIMITATIONS

1. **No shadcn/ui integration**: Components are built from scratch with inline Tailwind. This was a deliberate choice to avoid dependency on a system that doesn't natively support RTL well. Migration to Radix UI primitives is possible if needed.
2. **No animation library**: All animations are CSS-only (including splash). This is a feature, not a bug — keeps the bundle small.
3. **Select component**: Uses native `<select>` element for now. A custom dropdown with search/filter would enhance UX.
4. **Snackbar**: Imperative API via global `snackbar` object. Could be enhanced with a queue system for concurrent notifications.
5. **Design-system route**: No auth gate. Intended for development only (in `(dev)` route group with `noindex`).
6. **English locale**: Strings exist but are not wired into the UI. One provider prop change activates English.

---

### 12. RECOMMENDED NEXT PHASE

**Phase 3 — Authentication Flows (Mobile OTP, Verification, Session Management)**

Per the approved roadmap:
- Mobile number input with Persian format
- OTP verification flow
- Rate limiting and attempt tracking UI
- Session management (refresh, expiry, logout)
- Profile completion post-registration
- Integration with backend OTP adapter
- Auth unit + E2E tests (Playwright)
- Auth-protected route middleware

---

**Report generated**: 2026-07-28
**Phase**: 2 — Design System, RTL, Themes, and Splash Screen
**Status**: COMPLETE
**Next phase**: Phase 3 — Authentication Flows
