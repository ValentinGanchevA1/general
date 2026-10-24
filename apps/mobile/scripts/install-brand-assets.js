#!/usr/bin/env node
/**
 * NEXA brand assets are source-controlled and require no install/generation step.
 *
 * Canonical sources:
 * - JS compact identity: src/components/Brand/NexaSymbol.tsx
 * - JS lockup: src/components/Brand/BrandLogo.tsx
 * - JS expanded hero identity: src/components/Brand/NexaEntityOrbit.tsx
 * - Android launcher / monochrome / notification vectors: android/app/src/main/res/
 * - Native cold-start surface: blank #08090D BootSplash frame; the brand reveal
 *   is performed by NexaLaunchOverlay after React Native mounts.
 *
 * Do not restore retired G88 PNG artwork from older branches or patches.
 */
console.log('[brand:install] NEXA assets already in tree — nothing to do');
