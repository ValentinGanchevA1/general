import { readFileSync } from 'node:fs';
import path from 'node:path';

const privacyPolicyPath = path.resolve(
  __dirname,
  '../../../../docs/legal/privacy/index.html',
);

function readPrivacyPolicy(): string {
  return readFileSync(privacyPolicyPath, 'utf8');
}

describe('NEXA legal/product contract', () => {
  it('keeps the Privacy Policy aligned with the enforced 18+ onboarding rule', () => {
    const policy = readPrivacyPolicy();

    expect(policy).toContain('<strong>18 years old</strong>');
    expect(policy).toContain('confirm 18+ eligibility');
    expect(policy).not.toContain('at least <strong>13</strong>');
  });

  it('does not claim all storage cleanup is synchronous', () => {
    const policy = readPrivacyPolicy();

    expect(policy).toContain('storage cleanup may continue');
    expect(policy).toContain('retry cleanup');
  });
});
