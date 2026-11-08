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
  it('documents Social-wide 18+ eligibility and the first-release Dating hold', () => {
    const policy = readPrivacyPolicy();

    expect(policy).toContain('NEXUS is intended only for adults aged at least 18 years.');
    expect(policy).toContain('launch requests a date of birth at email registration');
    expect(policy).toContain('existing accounts without a birth date must complete the same age check');
    expect(policy).toContain('does not constitute independent age or identity verification');
    expect(policy).toContain('Dating and matchmaking remain unavailable during the first release.');
    expect(policy).toContain('Assess adult eligibility for the initial adult-only Social release');
    expect(policy).not.toContain('general social access does not require a universally adult profile');
    expect(policy).not.toContain('General NEXUS social features are not restricted to adults only.');
    expect(policy).not.toContain('Account registration does not currently request a date of birth.');
    expect(policy).not.toContain('at least <strong>13</strong>');
  });

  it('does not claim all storage cleanup is synchronous', () => {
    const policy = readPrivacyPolicy();

    expect(policy).toContain('storage cleanup may continue');
    expect(policy).toContain('retry cleanup');
  });
});
