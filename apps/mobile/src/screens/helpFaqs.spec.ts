import { NEXA_HELP_FAQS } from './helpFaqs';

describe('NEXUS Dating-only age scope — help content', () => {
  it('does not imply that all social registration is 18+', () => {
    const faq = NEXA_HELP_FAQS.find(({ q }) => q.includes('18+ app'));
    expect(faq).toBeDefined();
    expect(faq?.a).toContain('General social features are not automatically restricted to adults');
    expect(faq?.a).toContain('Optional Dating and matchmaking');
    expect(faq?.a).toContain('18 or older');
  });

  it('explains that a self-declared birth date is not proof of age', () => {
    const faq = NEXA_HELP_FAQS.find(({ q }) => q.includes('Who can use Dating'));
    expect(faq?.a).toContain('not independent proof of age');
    expect(faq?.a).toContain('additional protections');
  });
});
