# W2-1 Map World Context Selector QA

## Scope
A compact selector on the existing Map chrome activates the account-scoped World preference using the existing Redux thunk. It does not alter onboarding, navigation, map viewport, spatial lens, discovery query parameters, authorization, or realtime subscriptions.

## Acceptance / manual QA
- [ ] Selector is visible only where the existing DEV World Mode gate allows it.
- [ ] Modal lists the existing registry IDs, labels and palette symbols.
- [ ] Current World is marked selected.
- [ ] Selecting a different World persists through the existing activateWorldMode thunk and closes the modal only on success.
- [ ] Persistence failure remains in Redux error state and the modal stays open.
- [ ] Selector disabled while hydration is incomplete, ownership mismatch, or save in progress.
- [ ] Account switch cannot activate using stale account ownership.
- [ ] Map camera and selected entity remain unchanged after World switch.
- [ ] Spatial lens remains unchanged.
- [ ] No new discovery requests/socket subscriptions introduced by selector itself.
- [ ] Screen reader labels and 44dp minimum trigger/close target.
- [ ] Small-screen layout checked on Android.

## Constraints
World modes are decorative context in this release. This selector must not change visibility, privacy, trust, ranking, permissions, feature entitlement or backend authorization.
