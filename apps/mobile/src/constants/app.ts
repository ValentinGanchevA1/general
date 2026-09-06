// App-wide static constants surfaced in the informational screens
// (About / Help & Support / Privacy). Keep in one place so the version string
// and contact address don't drift between screens.

/** Marketing/display version shown on About + Profile footer. */
export const APP_VERSION = '1.0.0';

/** Support + data-request contact. Mirrors the privacy policy's contact email. */
export const SUPPORT_EMAIL = 'vganchev6@gmail.com';

/** Canonical hosted privacy policy (Render static site `g88-legal`). Same URL
 *  used by the Play store listing + Data Safety form. */
export const PRIVACY_POLICY_URL = 'https://g88-legal.onrender.com/privacy';

/** Terms of Service. Dedicated /terms page not published yet — reuse privacy
 *  host until a real ToS document is live. AuthScreen still labels the link
 *  "Terms of Service" for store-compliance wording. */
export const TERMS_OF_SERVICE_URL = 'https://g88-legal.onrender.com/privacy';
