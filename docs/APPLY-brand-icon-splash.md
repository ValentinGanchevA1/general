# Brand: G88 symbol → icon + splash + in-app logo

## Status (post #524 + fix/brand-logo-asset-path)

- `BrandLogo` requires `./g88-icon-1024.png` (co-located under `src/components/Brand/`)
- Android: `SplashTheme`, adaptive launcher, `splash_logo.png` on master
- `pnpm brand:install` is a no-op (assets committed)

## Verify
1. Rebuild Android
2. Cold boot: native splash → JS logo + spinner → Auth/Map
3. Auth shows brand mark (not text "G88")
