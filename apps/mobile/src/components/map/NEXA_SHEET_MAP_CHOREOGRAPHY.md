# NEXA Sheet ↔ Map Choreography v2

The map remains the primary surface while a spatial entity sheet is open. The sheet must feel attached to the selected entity rather than like an unrelated modal.

## Selection contract

- Map marker selection is controlled by `MapScreen` while preview/detail is active.
- Only one entity marker is selected at a time.
- Dismissing preview or detail clears the selected marker ring.
- Cluster selection and entity selection are mutually exclusive.

## Snap semantics

| Index | Height | Meaning |
| --- | --- | --- |
| 0 | 36% | Context / quick action |
| 1 | 62% | Detail / decision |

Changing snap points repositions the camera so the selected entity remains in the visible map area above the sheet.

## Camera choreography

The selected entity is never moved. Only the camera center changes.

- 36% sheet → selected entity targets ~32% screen Y.
- 62% sheet → selected entity targets ~19% screen Y.
- Current latitude/longitude delta is preserved, so a sheet snap never silently changes zoom.
- Reduced Motion uses an immediate camera update instead of animated motion.
- On final sheet dismissal, the pre-sheet region is restored when available.

## Privacy

Choreography is presentation-only. It must not:

- persist exact coordinates,
- emit a new analytics payload containing latitude/longitude,
- change PostGIS/discovery precision,
- expose hidden location values in copy.

## Haptics

Do not use `Vibration` as a fake cross-platform haptic. iOS vibration is too strong for selection feedback. Introduce semantic haptics only when a native haptic abstraction is available; the choreography API stays independent of that dependency.

## Performance

- Camera updates occur only when a sheet is presented or changes semantic snap state.
- No camera work is scheduled from sheet render loops.
- Marker selection remains a lightweight controlled prop into `MapMarkers`.
- Gorhom keeps ownership of sheet motion; no competing JS sheet animation is added.
