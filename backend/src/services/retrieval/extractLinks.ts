import { load } from 'cheerio';

const IGNORED_SCHEMES = /^(mailto|tel|javascript|data):/i;

export function extractLinks(html: string, baseUrl: string): string[] {
  const $ = load(html);
  const base = new URL(baseUrl);
  const seen = new Set<string>();
  const links: string[] = [];

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href')?.trim();
    if (!href || href.startsWith('#') || IGNORED_SCHEMES.test(href)) {
      return;
    }

    let resolved: URL;
    try {
      resolved = new URL(href, base);
    } catch {
      return;
    }

    if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') {
      return;
    }
    if (resolved.origin !== base.origin) {
      return;
    }

    resolved.hash = '';
    const normalized = resolved.toString();

    if (!seen.has(normalized)) {
      seen.add(normalized);
      links.push(normalized);
    }
  });

  return links;
}
