import { rankHiringLinks } from './rankLinks.js';

describe('rankHiringLinks', () => {
  it('ranks a hiring-process page above an unrelated pricing page', () => {
    const links = [
      'https://example.com/pricing',
      'https://example.com/careers/how-we-hire',
    ];

    const ranked = rankHiringLinks(links);

    expect(ranked[0]).toBe('https://example.com/careers/how-we-hire');
    expect(ranked[1]).toBe('https://example.com/pricing');
  });

  it('ranks common hiring-relevant pages above unrelated marketing pages', () => {
    const links = [
      'https://example.com/pricing',
      'https://example.com/blog/product-update',
      'https://example.com/careers',
      'https://example.com/jobs/senior-engineer',
      'https://example.com/engineering-blog/how-we-interview-engineers',
      'https://example.com/legal/terms',
      'https://example.com/life-at-example',
    ];

    const ranked = rankHiringLinks(links);
    const rankIndex = (url: string) => ranked.indexOf(url);

    for (const hiringUrl of [
      'https://example.com/careers',
      'https://example.com/jobs/senior-engineer',
      'https://example.com/engineering-blog/how-we-interview-engineers',
      'https://example.com/life-at-example',
    ]) {
      expect(rankIndex(hiringUrl)).toBeLessThan(rankIndex('https://example.com/pricing'));
      expect(rankIndex(hiringUrl)).toBeLessThan(rankIndex('https://example.com/legal/terms'));
    }
  });

  it('scores an engineering blog post about interviewing above a generic blog post', () => {
    const links = [
      'https://example.com/blog/company-picnic-photos',
      'https://example.com/engineering-blog/how-we-interview-engineers',
    ];

    const ranked = rankHiringLinks(links);

    expect(ranked[0]).toBe('https://example.com/engineering-blog/how-we-interview-engineers');
  });

  it('does not mutate the input array', () => {
    const links = ['https://example.com/b', 'https://example.com/a-careers'];
    const original = [...links];

    rankHiringLinks(links);

    expect(links).toEqual(original);
  });
});
