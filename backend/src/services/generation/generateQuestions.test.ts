import { categoriesForRequirement } from './generateQuestions.js';

describe('categoriesForRequirement', () => {
  it('routes a technical requirement to technical/system-design, never behavioural', () => {
    const categories = categoriesForRequirement('technical');

    expect(categories).toContain('technical');
    expect(categories).toContain('system-design');
    expect(categories).not.toContain('behavioural');
  });

  it('routes a behavioural requirement to behavioural only, never technical/system-design', () => {
    const categories = categoriesForRequirement('behavioural');

    expect(categories).toContain('behavioural');
    expect(categories).not.toContain('technical');
    expect(categories).not.toContain('system-design');
  });

  it('routes a domain requirement to company-fit, never behavioural', () => {
    const categories = categoriesForRequirement('domain');

    expect(categories).toContain('company-fit');
    expect(categories).not.toContain('behavioural');
  });
});
