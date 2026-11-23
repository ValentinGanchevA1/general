# NEXUS Map Advanced Filters — UX Specification

Status: design/spec only; no runtime implementation.
Related: #1167 (blocked pending #1166 merge and manual QA)

## Goal
Replace the existing advanced filter centered modal presentation with a responsive bottom-sheet presentation, preserving the current filter state, behavior, and callbacks. This is a presentation change—not a redesign of discovery or filter semantics.

## Constraints, risks and edge cases
- Keep existing Redux/store state and callbacks; no new backend/API/schema/permission work.
- Keep map renderer mounted; dismissing/applying filters must not reset camera, viewport or selected entity.
- Changing layer/context must preserve applicable existing selections and conditional sections. Do not silently clear values.
- Preserve the existing distinction between marketplace listing kind and Wanted/listing mode.
- Avoid duplicate viewport/discovery requests: UI changes should not trigger fetches until existing apply/commit semantics do.
- Sheet dismissal via backdrop, swipe, Android Back, or close control must match existing modal behavior; pending edits must follow the existing commit/discard behavior.
- Avoid focus traps; return accessibility focus to the filter button when dismissed.
- Test Android small screens, safe areas, dynamic font scaling, TalkBack and Reduced Motion.
- Minimum practical touch target 44dp; do not shrink labels or use icon-only controls without accessibility labels.
- Handle no filters, one filter, many active filters and empty sections.

## Proposed layout
1. Drag handle and title “Filters”; optional active-filter count.
2. Scrollable content:
   - Sort: existing sort options.
   - People: existing conditional People options.
   - Listings: existing listing-mode and marketplace taxonomy controls.
   - Saved places: existing toggle/section.
   - Local alerts: existing toggle/section.
3. Sticky footer:
   - Secondary “Reset” (only if existing reset semantics exist).
   - Primary “Apply” or “Done”, using existing state-commit behavior.
   - Footer respects bottom safe-area inset.

## Behavior
- Open: show current state, not defaults.
- Toggle/select: update sheet draft only if current implementation already uses draft state; otherwise preserve established immediate-commit behavior.
- Apply/Done: commit through existing callback; dismiss.
- Reset: use existing reset behavior and preserve other unrelated state.
- Dismiss: retain/discard pending changes according to existing modal semantics; document and test the chosen behavior.
- Android Back and swipe-to-dismiss must be equivalent to the close action.

## Responsive behavior
- Narrow width: full-width sheet with side gutters only where safe.
- Height: cap to available screen height; content scrolls independently; footer stays visible.
- Dynamic text: allow labels to wrap; avoid fixed-height rows that clip text.
- Safe area: account for top/bottom insets and keyboard where applicable.
- Reduced Motion: no spring/bounce transitions; use a short or no animation.

## Suggested component boundary
- MapFiltersSheet: presentation and sheet lifecycle.
- Existing filter content/components: reused; no duplicated filter state.
- Existing MapFilterRow entry point: opens sheet; callbacks remain unchanged.

## Acceptance criteria
- Existing filter semantics and state preserved.
- No duplicate discovery/viewport requests.
- Camera, viewport and selected entity remain intact after open/apply/dismiss.
- Android Back, backdrop, swipe and close are behaviorally equivalent.
- Safe-area, narrow screen and dynamic font scaling validated.
- TalkBack labels/selected states and focus return validated.
- Reduced Motion respected.
- Tests cover state persistence, conditional sections and marketplace/Wanted distinction.
- Physical-device QA evidence required before rollout.

## Implementation gate
Do not implement against master or merge until PR #1166 is reviewed, its unresolved CI workflows pass, and physical-device flag-on/off QA and map-state preservation checks are documented.
