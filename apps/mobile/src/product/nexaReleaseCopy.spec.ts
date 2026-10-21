import { NEXA_LOCATION_PERMISSION_COPY } from '@/features/location/locationPermissionCopy';
import { NEXA_HELP_FAQS } from '@/screens/helpFaqs';

describe('NEXA release-visible copy guard', () => {
  const helpCopy = NEXA_HELP_FAQS.flatMap(({ q, a }) => [q, a]).join('\n');

  it('keeps the Android location rationale on the NEXA brand', () => {
    expect(NEXA_LOCATION_PERMISSION_COPY.message).toContain('NEXA uses your location');
    expect(NEXA_LOCATION_PERMISSION_COPY.message).not.toContain('G88');
  });

  it('keeps Help aligned with the canonical Connections surface', () => {
    expect(helpCopy).toContain('What is Connections?');
    expect(helpCopy).not.toContain('What is the Interactions screen?');
    expect(helpCopy).not.toContain('Interactions is a focused inbox');
  });

  it('keeps verification factual and score-free', () => {
    expect(helpCopy).toContain(
      'They do not create a public trust or popularity score.',
    );
    expect(helpCopy).not.toContain('raise trust');
    expect(helpCopy).not.toContain('trust booster');
  });
});
