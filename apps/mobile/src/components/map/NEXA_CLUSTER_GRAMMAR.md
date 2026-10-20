# NEXA Cluster Visual Grammar v2

Clusters are spatial summaries, not a fourth entity type. Their visual language must preserve the semantic geometry of the entities they contain without turning the map into a pie chart.

## Classification

A cluster inherits an entity geometry only when one category represents at least **65%** of the classified points in `ClusterPoint.by`.

| Composition | Cluster geometry | Semantic color |
| --- | --- | --- |
| People-dominant | Circle | `entityPerson` / violet |
| Event-dominant | Diamond | `entityEvent` / cyan |
| Listing-dominant | Square | `entityListing` / neutral |
| No category >= 65% | Neutral circle | neutral border + micro geometry |

A single-category cluster is always treated as dominant.

## Mixed clusters

Mixed clusters do not invent a new brand color. The outer container is neutral and a small geometry row communicates which entity types are present:

- person → small violet circle
- event → small cyan diamond
- listing → small neutral square

The center count remains the primary information.

## Size tiers

| Count | Visual size |
| ---: | ---: |
| 1–9 | 40dp |
| 10–49 | 48dp |
| 50+ | 56dp |

The rendered root is 68dp so the interaction target remains comfortably above the 44dp accessibility minimum and the selected ring never clips.

Counts above 999 render as `999+`.

## Selection and expansion

Tapping a cluster:

1. marks it selected immediately;
2. raises its native marker z-index;
3. shows a violet action/focus ring;
4. preserves the existing smooth camera zoom toward the cluster center;
5. clears the selection naturally when the next discovery result no longer contains that cell.

This creates spatial continuity without running per-marker animation loops.

## Performance

- Cluster visuals are pure React Native geometry.
- No SVG or masked gradient is required.
- `clusterVisualKey()` controls native snapshot invalidation.
- `tracksViewChanges` re-opens only when cluster composition or selected state changes.
- No permanent glow, bounce, radar sweep, or repeating pulse.

## Accessibility

A cluster exposes a semantic label such as:

`Cluster, 10 nearby: 7 people, 2 events, 1 listing. Double tap to zoom in.`

Color is never the only category signal; dominant clusters use geometry and mixed clusters expose micro geometry.

## Backend contract

This implementation intentionally keeps the current shared DTO unchanged:

```ts
export interface ClusterPoint {
  kind: 'cluster';
  cellId: string;
  lat: number;
  lng: number;
  count: number;
  by: Partial<Record<EntityKind, number>>;
}
```

Opportunity clusters remain out of scope until Opportunity becomes part of the shared discovery entity contract.
