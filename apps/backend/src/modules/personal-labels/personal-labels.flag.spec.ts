import { NotFoundException } from '@nestjs/common';
import { personalLabelsEnabled, requirePersonalLabelsEnabled } from './personal-labels.flag';
import { normalizePersonalLabelText } from './personal-labels.service';

describe('personal labels release gate and normalization', () => {
  const original = process.env.NEXA_PERSONAL_LABELS_ENABLED;
  afterEach(() => {
    if (original === undefined) delete process.env.NEXA_PERSONAL_LABELS_ENABLED;
    else process.env.NEXA_PERSONAL_LABELS_ENABLED = original;
  });
  it.each([undefined, '', 'false', 'TRUE', '1', ' true ', 'yes'])(
    'fails closed for %p', (v) => expect(personalLabelsEnabled(v)).toBe(false),
  );
  it('requires exact true', () => {
    delete process.env.NEXA_PERSONAL_LABELS_ENABLED;
    expect(() => requirePersonalLabelsEnabled()).toThrow(NotFoundException);
    process.env.NEXA_PERSONAL_LABELS_ENABLED = 'true';
    expect(() => requirePersonalLabelsEnabled()).not.toThrow();
  });
  it('normalizes whitespace and rejects URLs/markup', () => {
    expect(normalizePersonalLabelText('  Нощна   сова  ')).toBe('Нощна сова');
    expect(() => normalizePersonalLabelText('https://example.com')).toThrow();
    expect(() => normalizePersonalLabelText('<script>')).toThrow();
    expect(() => normalizePersonalLabelText('x')).toThrow();
  });
});
