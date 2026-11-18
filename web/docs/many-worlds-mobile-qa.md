# MANY WORLDS Web — responsive QA (public demo)

Branch: `feature/many-worlds-v4-mobile-responsive`. Preview-only, no live user data.

## Manual device matrix

| Width | Target | Checks |
| --- | --- | --- |
| 320 px | narrow Android | No horizontal body scroll; world chips swipe horizontally; map and nav operable |
| 360 px | small Android | Header occupies minimal height; map appears before concept cards |
| 412 px | Galaxy S25 / simulated Android | Active world chip remains visible after switch; map gestures work; bottom navigation accessible |
| 768 px | tablet portrait | Header wraps without overflow, navigation remains usable |
| 1024 px | tablet landscape | World panels and map fit inside shell |
| 1440 px | desktop | Full grid layouts preserved |

## Acceptance criteria

- Open `/?manyWorlds=1&world=noir`. Selected NOIR chip visible, 10 choices available by swipe.
- On a spatial tab, the map precedes `world-experience` and `world-stage` visually below 761 px; preserve existing DOM map on world switch.
- Scroll the map, use zoom buttons, change to BAZAAR, then back to NOIR. No unexpected jump to top and no loss of map viewport.
- Each selected world shows its own conceptual actions and workspace without claiming live data.
- Touch targets of world switcher are at least 44 px tall; bottom nav respects safe area.
- Open Firefox responsive design mode or Chrome device emulation at 412 px; reload once when prompted by DevTools to apply device simulation changes.
- With `PUBLIC_DEMO_ONLY=1`, backend and Socket.IO routes return 503; do not test with real credentials.
- On physical Android, verify visible map, chip swiping, touch interactions, and no horizontal overflow. CI static contracts do **not** establish physical device QA.

## Safe deployment

1. Require green Web Preview CI (TypeScript, build, world contracts, responsive contract, public-demo isolation).
2. Merge into isolated preview branch only — never master/production from this PR.
3. Trigger Render demo deploy with autoDeploy disabled.
4. Verify commit SHA and Render `live` status, then test the exact public URL and collect device screenshots.
