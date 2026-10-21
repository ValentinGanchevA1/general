import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const readMobileSource = (...segments: string[]): string =>
  readFileSync(join(__dirname, '..', ...segments), 'utf8');

describe('NEXA release-visible copy guard', () => {
  const locationSource = readMobileSource('features', 'location', 'useUserLocation.ts');
  const helpSource = readMobileSource('screens', 'HelpScreen.tsx');

  it('keeps the Android location rationale on the NEXA brand', () => {
    expect(locationSource).toContain('NEXA uses your location');
    expect(locationSource).not.toContain('G88 needs your location');
  });

  it('keeps Help aligned with the canonical Connections surface', () => {
    expect(helpSource).toContain('What is Connections?');
    expect(helpSource).not.toContain('What is the Interactions screen?');
    expect(helpSource).not.toContain('Interactions is a focused inbox');
  });

  it('keeps verification factual and score-free', () => {
    expect(helpSource).toContain(
      'They do not create a public trust or popularity score.',
    );
    expect(helpSource).not.toContain('raise trust');
    expect(helpSource).not.toContain('trust booster');
  });
});
