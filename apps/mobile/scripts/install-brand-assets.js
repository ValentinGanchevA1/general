#!/usr/bin/env node
/**
 * Brand PNGs ship in-tree:
 * - apps/mobile/src/components/Brand/g88-icon-1024.png (JS BrandLogo)
 * - apps/mobile/android/app/src/main/res/drawable/splash_logo.png
 * - apps/mobile/android/app/src/main/res/mipmap-*/ic_launcher*.png
 *
 * No pack scripts required after #524 merge.
 */
console.log('[brand:install] assets already in tree — nothing to do');
