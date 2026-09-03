# Apply map empty state

Branch `feat/entity-sheet-map-empty-v2` includes EntityBottomSheet CTA hierarchy + IdentityBlock.

Map empty overlay requires `EmptyState` from `feat/design-system-shared-identity`.

```bash
git fetch origin
git checkout feat/entity-sheet-map-empty-v2
# ensure design-system components are present (merge or cherry-pick)
git merge origin/feat/design-system-shared-identity
git apply 0001-feat-map-empty-state.patch
# or: patch -p1 < 0001-feat-map-empty-state.patch
```

## Patch changes
- Import EmptyState
- Entity sheet snaps: 36% / 62%
- Empty overlay when `!loading && points.length === 0 && region`
- `emptyOverlay` style

## Device smoke
1. Open map with empty viewport → card "No one nearby yet" + Refresh
2. Tap user marker → sheet shows Wave/Message first, then trust/stats
3. ID-verified peer → verified ring; friend → green ring
