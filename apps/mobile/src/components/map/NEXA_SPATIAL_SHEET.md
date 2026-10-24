# NEXA Bottom Sheet Identity v3

The map is the product. Entity sheets are the spatial continuation of a selected map marker, not generic modal cards.

## Canonical entity grammar

| Entity | Geometry | Semantic color | Primary intent |
| --- | --- | --- | --- |
| Person | Circle | Violet | Connect / interact |
| Event | Four-point star | Cyan | Join / participate |
| Listing | Square | Neutral | View / negotiate |
| Opportunity / other | Diamond | Violet / opportunity | Explore / act |

The same geometry must remain recognizable across splash, Map, Discover, Pulse, Search, notifications, and sheets.

## Sheet anatomy

Every spatial sheet follows the same order:

1. drag handle + 24dp elevated top corners
2. semantic entity glyph and entity label
3. identity/title
4. distance / freshness / status metadata
5. contextual supporting content
6. primary action
7. secondary action(s), including Map/Details where relevant

The shell owns visual hierarchy only. Existing feature modules continue to own business logic, navigation, network calls, and state machines.

## Interaction rules

- Primary target height: at least 44dp; implementation uses 46dp.
- Primary action uses entity semantics: violet for people/action, cyan for events/discovery, violet fallback for opportunities, violet action for marketplace conversion.
- Secondary actions use elevated neutral surfaces or quiet text actions.
- Loading and disabled states retain layout to avoid sheet jumps.
- Pan-down dismiss remains supported by Gorhom BottomSheet.
- The map stays mounted behind the sheet.

## Distance and location privacy

`formatNexaSpatialDistance` is presentation-only and intentionally coarsens proximity:

- under 100m -> `Nearby`
- under 1km -> rounded to nearest 100m
- under 10km -> rounded to 0.1km
- otherwise -> rounded kilometres

Ranking, PostGIS queries, hit-testing, and viewport logic continue to use internal coordinates/distances. The UI must not turn internal precision into casual people-location leakage.

## Opportunity contract boundary

`Opportunity` is part of NEXA's visual grammar now, but it is **not** part of the current shared `EntityPoint` discovery DTO. The spatial-sheet primitives support `opportunity` so future surfaces use the same design system, but this phase does not add a fake `EntityPoint.kind`, backend response, database entity, or socket contract.

When Opportunity becomes a discovery entity, extend `@g88/shared` first and then add the adapter. Do not cast opportunity data into another entity kind.

## Accessibility

- Kind glyphs are decorative when the surrounding sheet already provides a semantic label.
- Actions expose role, label, disabled and busy state.
- Color is never the only entity discriminator: shape + text label are always present.
- Metadata remains text-readable and does not rely on icons alone.

## Performance

- Presentational primitives have no network effects.
- No image fetch is introduced by the shell.
- No timers or JS animation loops are introduced.
- Existing pin interaction state machine remains the owner of selection/detail transitions.
