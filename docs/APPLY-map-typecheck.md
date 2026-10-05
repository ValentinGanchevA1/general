# Apply map typecheck fix (CI Mobile)

```bash
git checkout master && git pull
git checkout -b fix/ci-map-typecheck-v2
git apply docs/patches/0001-fix-map-typecheck-chrome-nav.patch
# or copy full files from artifacts if patch conflicts:
# cp MapScreen.typecheck-fix.tsx apps/mobile/src/screens/MapScreen.tsx
# cp EntityBottomSheet.typecheck-fix.tsx apps/mobile/src/components/map/EntityBottomSheet.tsx
pnpm --filter @g88/mobile typecheck
git add apps/mobile/src/screens/MapScreen.tsx apps/mobile/src/components/map/EntityBottomSheet.tsx
git commit -m "fix(mobile): MapScreen chrome/filter/trending/empty + Event/Listing openRootScreen"
git push -u origin HEAD
```

## Errors fixed

1. EntityBottomSheet EventDetail/ListingDetail navigate → openRootScreen (nested stacks)
2. MapChrome props: sheetOpen, interactionUnread, onPressInteractions, topStack, onDismissChallenge
3. MapFilterRow: value, onChangeText, top, onPressCreate
4. TrendingCard: top + visible
5. EmptyState: actionLabel/onAction + mapEmptyCopy.actionKind (hide when nudge visible)
