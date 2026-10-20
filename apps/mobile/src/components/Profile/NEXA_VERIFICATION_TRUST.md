# NEXA Verification & Trust Visual System v2

## Product rule

Verification is a set of explicit identity signals, not a public vanity score.

NEXA may continue to carry an internal/legacy numeric `verificationScore` in API models for compatibility, but mobile UI must not present that number as a public trust percentage.

## Progressive states

| State | Meaning | Primary visual |
| --- | --- | --- |
| Basic profile | Core verification incomplete | neutral shield |
| Contact verified | Email + phone verified | violet shield |
| Identity verified | Government ID verified | cyan shield + check |
| Trusted profile | Core identity verified + optional supporting profile connected | cyan verified mark + secondary violet ring |

A connected social/profile account is an optional supporting signal. It never substitutes for government ID verification.

## Color semantics

- Violet / `actionPrimary`: actions and next steps.
- Cyan / `verified`, `discovery`: verified identity, live system confirmation, trusted-state accents.
- Warning: review pending.
- Danger: rejected / needs attention.
- Neutral surfaces: incomplete or optional signals.

Do not use gold to imply identity verification.

## Trust Center

The Trust Center:

- shows the current progressive state;
- lists explicit email, phone, government ID, and connected-profile signals;
- routes to the existing verification/linking flows;
- does not show a numeric trust percentage;
- explains that verification confirms signals, not future behavior or safety.

## ID verification

State behavior:

- `pending`: blocks duplicate submission and shows review-in-progress state;
- `verified`: blocks resubmission and shows the cyan verified state;
- `rejected`: allows a new submission with an attention state;
- `none`: normal 3-step capture flow.

Capture sequence remains:

1. Selfie.
2. Government ID front.
3. Government ID back (optional).

No backend DTO, upload transport, S3, or verification-status contract changes are introduced by this visual migration.

## Privacy

- Submitted selfie/ID images must never appear as public profile content.
- Public surfaces display verification state/signals only.
- No exact location is involved in verification UI.
- No trust state should be described as a guarantee that another person is safe.

## Profile surfaces

Public/self profile surfaces must use labels such as `Verified`, `ID verified`, and explicit earned signals instead of `85% trust`, `100% verified`, or similar numeric badges.

Legacy component/API property names containing `Score` or `verificationScore` may remain temporarily for compatibility, but they must not render the numeric value.

## Accessibility

- Verification state is communicated in text as well as color.
- Primary controls are at least 44dp high.
- Cyan check/shield state has an explicit accessibility label.
- Pending and rejected states use text labels, not icon/color alone.
