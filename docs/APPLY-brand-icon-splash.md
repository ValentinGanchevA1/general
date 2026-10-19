# Brand: G88 symbol → icon + splash + in-app logo

## Branch `feat/brand-icon-splash`

### Already on branch (committed)
- `BrandLogo.tsx`
- Android `SplashTheme`, colors, adaptive icon XML, MainActivity theme switch
- Manifest SplashTheme
- `pnpm brand:install` script hook

### Apply TSX patch (Auth + AppNavigator)
```bash
cd apps/mobile
git apply patches/brand-auth-nav.patch
# or from repo root:
git apply apps/mobile/patches/brand-auth-nav.patch
```

### Install PNG assets (launcher + splash + in-app logo)
After pull, either:
1. Copy from local agent artifacts (`src/assets/logo.png`, mipmaps, `drawable/splash_logo.png`), or
2. Run generator once you have `Designer (1).png` master, then:
```bash
cd apps/mobile && pnpm brand:install
```
(Requires `scripts/install-brand-mipmaps.js` + `install-brand-logos.js` from agent artifacts if not yet pushed — binary pack.)

### Verify
1. Rebuild Android
2. Cold boot: native splash → JS logo + spinner → Auth/Map
3. Auth shows brand mark
