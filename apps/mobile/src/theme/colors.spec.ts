import { nexaBrand, nexaDark, nexaGradients } from './brand';
import { darkColors, lightColors } from './colors';

describe('NEXA color semantics', () => {
  it('uses violet for action and people in dark mode', () => {
    expect(darkColors.actionPrimary).toBe(nexaBrand.violet);
    expect(darkColors.primary).toBe(nexaBrand.violet);
    expect(darkColors.entityPerson).toBe(nexaBrand.violet);
    expect(darkColors.entityUser).toBe(darkColors.entityPerson);
  });

  it('uses cyan for discovery, live, verification and events', () => {
    expect(darkColors.discovery).toBe(nexaBrand.cyan);
    expect(darkColors.live).toBe(nexaBrand.cyan);
    expect(darkColors.verified).toBe(nexaBrand.cyan);
    expect(darkColors.entityEvent).toBe(nexaBrand.cyan);
  });

  it('keeps listings neutral and opportunities violet-to-cyan', () => {
    expect(darkColors.entityListing).toBe(nexaDark.textPrimary);
    expect(darkColors.entityOpportunity).toBe(nexaBrand.violet);
    expect(nexaGradients.opportunity).toEqual([
      nexaBrand.violet,
      nexaBrand.cyan,
    ]);
  });

  it('maps legacy dark aliases onto the new semantics', () => {
    expect(darkColors.bg).toBe(darkColors.canvas);
    expect(darkColors.surface).toBe(darkColors.surfacePrimary);
    expect(darkColors.primary).toBe(darkColors.actionPrimary);
    expect(darkColors.accent).toBe(darkColors.discovery);
    expect(darkColors.action).toBe(darkColors.actionPrimary);
    expect(darkColors.primarySoft).toBe(darkColors.actionSoft);
  });

  it('maps legacy light aliases onto the active light semantics', () => {
    expect(lightColors.bg).toBe(lightColors.canvas);
    expect(lightColors.surface).toBe(lightColors.surfacePrimary);
    expect(lightColors.primary).toBe(lightColors.actionPrimary);
    expect(lightColors.accent).toBe(lightColors.discovery);
    expect(lightColors.action).toBe(lightColors.actionPrimary);
    expect(lightColors.primarySoft).toBe(lightColors.actionSoft);
  });

  it('keeps light surfaces and text distinct from the dark palette', () => {
    expect(lightColors.canvas).not.toBe(darkColors.canvas);
    expect(lightColors.surfacePrimary).not.toBe(darkColors.surfacePrimary);
    expect(lightColors.textPrimary).not.toBe(darkColors.textPrimary);
    expect(lightColors.shadowInk).not.toBe(lightColors.canvas);
  });

  it('keeps semantic foregrounds available for branded actions', () => {
    expect(lightColors.onPrimary).toBeTruthy();
    expect(darkColors.onPrimary).toBeTruthy();
    expect(lightColors.textInverse).toBeTruthy();
    expect(darkColors.textInverse).toBeTruthy();
  });

  it('preserves entity identity across light and dark modes', () => {
    expect(lightColors.entityPerson).toBe(darkColors.entityPerson);
    expect(lightColors.entityEvent).toBe(darkColors.entityEvent);
    expect(lightColors.entityOpportunity).toBe(darkColors.entityOpportunity);
  });
});
