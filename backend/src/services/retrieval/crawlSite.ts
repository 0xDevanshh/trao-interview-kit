import { fetchPage } from './fetchPage.js';
import { extractLinks } from './extractLinks.js';
import { rankHiringLinks } from './rankLinks.js';
import { cleanText } from './cleanText.js';

const MAX_PAGES = 6;

export interface CrawlResult {
  pages: { url: string; text: string }[];
  attempted: string[];
  failed: { url: string; reason: string }[];
}

export async function crawlCompanySite(companyUrl: string): Promise<CrawlResult> {
  const pages: CrawlResult['pages'] = [];
  const attempted: string[] = [companyUrl];
  const failed: CrawlResult['failed'] = [];

  const homepage = await fetchPage(companyUrl);
  if (!homepage.ok) {
    failed.push({ url: companyUrl, reason: homepage.reason });
    return { pages, attempted, failed };
  }

  pages.push({ url: homepage.finalUrl, text: cleanText(homepage.html) });

  const links = extractLinks(homepage.html, homepage.finalUrl);
  const ranked = rankHiringLinks(links);

  const visited = new Set<string>([companyUrl, homepage.finalUrl]);
  const candidates = ranked
    .filter((link) => !visited.has(link))
    .slice(0, Math.max(0, MAX_PAGES - 1));

  attempted.push(...candidates);

  const results = await Promise.all(candidates.map((link) => fetchPage(link)));

  results.forEach((result, index) => {
    const link = candidates[index]!;
    if (!result.ok) {
      failed.push({ url: link, reason: result.reason });
      return;
    }
    pages.push({ url: result.finalUrl, text: cleanText(result.html) });
  });

  return { pages, attempted, failed };
}
