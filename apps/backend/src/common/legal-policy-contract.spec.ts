import { readFileSync } from 'node:fs';
import path from 'node:path';

const privacyPolicyPath = path.resolve(
  __dirname,
  '../../../../docs/legal/privacy/index.html',
);

function readPrivacyPolicy(): string {
  return readFileSync(privacyPolicyPath, 'utf8');
}

describe('NEXUS legal/product contract', () => {
  it('accurately describes Dating-only adulthood and optional general-profile DOB', () => {
    const policy = readPrivacyPolicy();

    expect(policy).toContain('<strong>18 years old</strong>');
    expect(policy).toContain('confirm 18+ eligibility');
    expect(policy).toContain('General NEXUS social features are not restricted to adults only.');
    expect(policy).toContain('Dating and matchmaking are reserved for users');
    expect(policy).not.toContain('NEXUS is intended for adults;');
    expect(policy).toContain('Account registration does not currently request a date of birth.');
    expect(policy).toContain('A self-reported birth date is not independent age or identity verification.');
    expect(policy).not.toContain('onboarding flow requires a date of birth');
    expect(policy).not.toContain('at least <strong>13</strong>');
  });

  it('does not claim all storage cleanup is synchronous', () => {
    const policy = readPrivacyPolicy();

    expect(policy).toContain('storage cleanup may continue');
    expect(policy).toContain('retry cleanup');
  });
});
