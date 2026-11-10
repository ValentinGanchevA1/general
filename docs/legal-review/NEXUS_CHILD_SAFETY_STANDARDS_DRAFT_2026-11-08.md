# NEXUS Child Safety Standards — WORKING DRAFT
**Internal/legal-review document — NOT APPROVED, NOT PUBLISHED, NOT A CLAIM OF GOOGLE PLAY COMPLIANCE.**

Intended product: **NEXUS**, the final public brand. The **entire first-release Social app is 18+** (#1068, #1071), and Dating is disabled. This draft **cannot** be published as a final policy until adult-age gating, child-safety protections and the reporting/response process are independently verified.

## Required decision sheet before legal sign-off
- [x] Public brand confirmed by product owner: **NEXUS**. Legacy NEXA issue references must be updated before release.
- [ ] Confirm operator legal entity/contact and **designated named child-safety representative** (authorized to receive and act on Play notices).
- [x] Owner decision: **all Social access is restricted to adults 18+ at launch**; select only 18 and over and enable Restrict Minor Access in Google Play Console.
- [ ] Verify backend REST/WebSocket adult eligibility gate, OAuth/existing account recovery, age-declaration handling and any stronger age verification required by applicable law or Google Play policy.
- [ ] Determine whether under-18 users can register or access messaging, nearby persons, meetups, marketplace or exact location sharing; document defaults and safeguarding.
- [ ] Define real incident duty coverage and handling times; do not promise 24/7 or specific SLA without staff.
- [ ] Confirm operational process for CSAM removal, preservation where legally required, and reporting to competent authorities (jurisdiction-dependent; counsel review).
- [ ] Confirm user-facing report/block paths on the **exact release AAB and deployed API**.
- [ ] Have qualified legal/safety reviewer validate policy and applicable child-safety regulations before publication.

## 1. Zero tolerance for child sexual abuse and exploitation
NEXUS prohibits child sexual abuse and exploitation (CSAE), including child sexual abuse material (CSAM), grooming, sextortion, solicitation for sexual contact with a minor, trafficking or exploitation of children, and attempts to arrange or facilitate these acts. Text, images, audio, video, profiles, stories, messages, listings, events and external links fall under this rule. AI-generated or altered material is not an exception where illegal or exploitative.

Users must not create, upload, request, distribute, link to, promote or use NEXUS to facilitate prohibited content and behavior. Suspected child exploitation should not be amplified by copying or forwarding material.

## 2. How to report a safety concern
NEXUS users should have accessible in-app reporting for a user/profile and relevant user-generated content, and blocking controls for direct interactions. Reporters should include only necessary context such as the affected user/content reference and reason; **do not send copies of potentially illegal imagery**.

**Implementation verification required:** The in-app report surface, backend persistence, accessibility, admin moderation workflow, and reporting failure state must be tested against the exact deployed build. The app must not display a success state unless the report is actually received.

**Alternative contact (must be confirmed before publishing):** [CHILD SAFETY PUBLIC EMAIL OR FORM]. 
**Urgent danger:** Contact the local emergency service or appropriate law-enforcement authority. The app's reporting tools are not emergency responders.

## 3. Moderation and response
NEXUS intends to review child-safety reports using a restricted moderation workflow. Where warranted and lawful, NEXUS can restrict access, remove content, disable affected accounts, prevent abusive contact and escalate to competent authorities. Repeat offenders and attempts to evade enforcement may lead to further restrictions.

Specific response times, appeal procedures and law-enforcement reporting routes are **not finalized** and must reflect actual operational capacity and legal obligations. An investigation is not a guarantee of any particular outcome.

## 4. Privacy, minor safety and location
The nearby map does not show raw GPS coordinates for general public discovery, but a coarsened location can still present re-identification or safety risks. Separately, when enabled, live precise location sharing in a one-to-one chat exposes precise coordinates to the chosen participant and is persisted in session/message records. Under-18 accounts must not be given access to NEXUS map, chat, events, listings or live-location sharing at launch. Independent runtime and physical-device QA of this restriction are required. Do not imply an unverified DOB proves identity.

Dating/matchmaking is **not part of the initial release**. Self-declared date of birth alone is not independent age verification and cannot support broad claims of robust age assurance.

## 5. Account controls, transparency and updates
Users should be able to report and block abuse, reduce visibility and delete their account even if they have not accepted updated content-publishing Terms. NEXUS should maintain an accessible record of current Community/Child Safety Standards, notify users of material changes as appropriate and apply reasonable moderation consistently.

**Effective date:** [REVIEW / NOT SET].
**Operator:** [VERIFY].
**Child-safety contact:** [NAME + ROLE + CONTACT, FOR PLAY CONSOLE].
**Public URL to decide:** [DO NOT PUBLISH BEFORE APPROVAL].

---
## Publication prohibition
This file is not a production policy. Legal/safety review and actual operating procedures are mandatory before anyone may publish an external child-safety standards page or self-certify the Play Console Child Safety Standards questionnaire.
