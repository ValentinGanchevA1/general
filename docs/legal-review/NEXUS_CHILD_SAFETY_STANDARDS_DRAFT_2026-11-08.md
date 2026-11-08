# NEXUS Child Safety Standards — REVIEW DRAFT (NOT PUBLISHED)
**Last edited: 8 November 2026 · For product, safety and qualified legal review · NOT approved, not a published policy and not a claim of Google Play compliance.**

Google Play Child Safety Standards apply to **Social** apps regardless of whether children are the intended audience.
Sources: https://support.google.com/googleplay/android-developer/answer/14747720 and https://support.google.com/googleplay/android-developer/answer/9876937 .

## Publishable policy copy — only after approvals

### Commitment
NEXUS strictly prohibits child sexual abuse and exploitation (CSAE) and child sexual abuse material (CSAM). These rules apply to profiles, photographs, Stories, messages, event information, listings, offers, groups and all other areas of the service, including private communications.

We prohibit sexual grooming of children, sexualized contact requests, sextortion, coercion, trafficking, sexual solicitation of minors, creation or distribution of CSAM, links directing users to such material, and using location information to exploit or endanger a child. Do not use NEXUS to stalk or pressure anyone.

### Reporting and blocking
NEXUS provides in-app controls to report profiles and Stories, and users may block other accounts. **[PRODUCT: verify whether message, listing and event-specific reporting is available in the release build; do not promise an unavailable reporting action.]**

**Child-safety contact:** [APPROVED, MONITORED EMAIL / WEB FORM] (must be reachable without account access).
If someone is in immediate danger, contact local emergency services. Do not send or redistribute CSAM as an attachment when reporting. Use the designated secure reporting channel.

### Enforcement and safety handling
Our safety process prioritizes reports involving potential exploitation of children. We may remove content and restrict accounts where supported by applicable product tooling and law. Where required, we report apparent CSAM to appropriate authorities and preserve strictly limited evidence under applicable law and secure procedures.

**[SAFETY OPERATIONS: confirm written, exercised protocol for intake, escalation, designated personnel, authority reporting, evidence handling, preservation/minimization and appeals. Current application moderation has Report Profile / Story and story soft-hide; account suspension, chat-message moderation and immediate takedown propagation require separate verification. Do NOT claim operational capabilities not implemented.]**

### Age rules
NEXUS's general social functions are not declared universally 18+. Their lowest supported age and age-appropriate privacy/consent safeguards remain under review. **Optional Dating/matchmaking is adult-only (18+) and disabled in the early-access release** while independent age assurance is prepared. Entering a birth date in a profile is not independent verification of adulthood.

### Privacy and location
Public map presence is privacy-coarsened, but may still reveal approximate whereabouts. Opt-in precise 1:1 chat location sharing requires additional safeguarding review if younger users are in scope. **[PRODUCT: review safety defaults and adult-to-minor messaging/location/contact restrictions before authorizing 16–17 or younger users.]**

## Must complete before publishing this page or Play Console Child Safety declaration
- [ ] Qualified legal reviewer approves all content, including law enforcement escalation and data handling.
- [ ] Product owner approves clear prohibited-content rules and minimum eligible Social age.
- [ ] Establish and test child-safety reporting contact and an on-call owner; do not publish unmonitored addresses.
- [ ] Demonstrate in-app child safety feedback/reporting and blocking on signed Android build.
- [ ] Write and rehearse CSAM escalation / safe evidence procedure. Limit personnel and sensitive content access; never reproduce CSAM in ordinary tickets or screenshots.
- [ ] Implement any missing message/listing/event moderation actions or accurately scope the published text; identify procedures to restrict an account and preserve audit history.
- [ ] Implement teen safety rules for discovery, chat, invitations, gifts, live location and account visibility if teen users are allowed.
- [ ] Publish approved, versioned HTTPS page reachable without a login (suggested: `https://g88-legal.onrender.com/child-safety`), separate from Privacy / Terms.
- [ ] Provide the exact approved URL and dedicated contact in Play Console; confirm anonymous external access.
- [ ] Capture release owner, legal, safety and security sign-off evidence.

**This file is intentionally under `docs/legal-review/`. It must not be treated as public-facing standards until all items above are verified.**
