# Brand: G88 symbol → icon + splash + in-app logo

Source: `attachments/Designer (1).png` (antenna / signal mark, cyan→magenta on dark).

## Applied in repo (`apps/mobile`)

### Android launcher
- All `res/mipmap-*/ic_launcher.png` + `ic_launcher_round.png` replaced
- Adaptive icons: `mipmap-anydpi-v26/ic_launcher.xml` (+ round) → foreground + `#0A0E20` background
- `values/colors.xml`: `ic_launcher_background`, `splash_background`

### Android native splash
- `drawable/splash_logo.png` + `drawable/splash_screen.xml` (centered logo on dark)
- `values/styles.xml`: `SplashTheme` (windowBackground = splash) + `AppTheme` window/status bar dark
- `AndroidManifest`: `MainActivity` uses `@style/SplashTheme`
- `MainActivity.kt`: `setTheme(R.style.AppTheme)` in `onCreate` so RN does not keep the splash bitmap under the root view

### JS / product surfaces
- `src/assets/logo.png` (+ transparent variant)
- `src/components/Brand/BrandLogo.tsx`
- Session restore gate in `AppNavigator`: logo + spinner
- `AuthScreen`: text "G88" → `BrandLogo`

### Install assets after pull
```bash
cd apps/mobile && pnpm brand:install
```

### Handoff (iOS)
- `artifacts/brand/ios/AppIcon.appiconset/` — drop into `Images.xcassets` when iOS project is present

## Verify
1. `pnpm brand:install` then rebuild Android
2. Cold boot: native splash → JS splash (logo + spinner) → Auth or Map
3. Auth: logo above Sign in / Create account
