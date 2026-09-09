import { fetch } from 'undici';
import { load } from 'cheerio';
import { fetchPage } from './fetchPage.js';
import { cleanText } from './cleanText.js';
import { withOriginRateLimit } from './rateLimiter.js';

/**
 * DuckDuckGo's HTML endpoint (html.duckduckgo.com/html) is an unofficial,
 * undocumented scraping surface, not a published/versioned API. It's used
 * here specifically because it needs no API key, matching the "genuine free
 * tier" constraint on this project's search dependency. Its markup can
 * change, or it can start blocking automated traffic, at any time — that's a
 * known, accepted trade-off, not a bug to chase with unbounded retries. If
 * this endpoint stops working, the fix is to swap in a real search API, not
 * to retry harder.
 *
 * The search request itself is made with a plain fetch rather than
 * fetchPage/urlGuard: those exist to defend against fetching arbitrary,
 * attacker-influenced URLs (SSRF, robots.txt, private IPs), which doesn't
 * apply to this one fixed, hardcoded endpoint. fetchPage IS used for the
 * actual discussion pages found in the results, since those URLs are
 * effectively external and unvalidated.
 */

const SEARCH_ENDPOINT = 'https://html.duckduckgo.com/html/';
const MAX_SEARCHES = 3;
const MAX_PAGE_FETCHES = 3;
const SEARCH_TIMEOUT_MS = 8000;

export interface DiscussionResult {
  snippets: { url: string; text: string }[];
  failed: { source: string; reason: string }[];
}

function buildQueries(companyName: string, roleTitle?: string): string[] {
  const rolePart = roleTitle ? ` ${roleTitle}` : '';
  return [
    `"${companyName}"${rolePart} interview process`,
    `"${companyName}" glassdoor interview`,
    `"${companyName}" interview questions reddit`,
  ].slice(0, MAX_SEARCHES);
}

function isSubstantiveSource(url: string): boolean {
  let hostname: string;
  let pathname: string;
  try {
    const parsed = new URL(url);
    hostname = parsed.hostname.toLowerCase();
    pathname = parsed.pathname.toLowerCase();
  } catch {
    return false;
  }

  if (hostname.includes('glassdoor.')) return true;
  if (hostname.includes('teamblind.com')) return true;
  if (hostname.includes('reddit.com')) return true;
  if (hostname.includes('leetcode.com') && pathname.includes('discuss')) return true;
  if (pathname.includes('/blog') || hostname.startsWith('blog.') || hostname.includes('engineering.')) return true;

  return false;
}

function extractTargetUrl(href: string): string | null {
  if (!href) return null;

  try {
    const asUrl = new URL(href, 'https://duckduckgo.com');

    // DuckDuckGo's HTML results wrap outbound links in a redirect of the
    // form //duckduckgo.com/l/?uddg=<encoded target>&...
    if (asUrl.hostname.endsWith('duckduckgo.com') && asUrl.pathname === '/l/') {
      const target = asUrl.searchParams.get('uddg');
      return target ? decodeURIComponent(target) : null;
    }

    if (asUrl.protocol === 'http:' || asUrl.protocol === 'https:') {
      return asUrl.toString();
    }

    return null;
  } catch {
    return null;
  }
}

type SearchOutcome = { ok: true; urls: string[] } | { ok: false; reason: string };

async function searchDuckDuckGo(query: string): Promise<SearchOutcome> {
  const endpoint = `${SEARCH_ENDPOINT}?q=${encodeURIComponent(query)}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);

  try {
    const response = await withOriginRateLimit(endpoint, () =>
      fetch(endpoint, {
        signal: controller.signal,
        headers: {
          'user-agent': 'Mozilla/5.0 (compatible; TraoInterviewKitBot/1.0)',
        },
      }),
    );

    if (!response.ok) {
      return { ok: false, reason: `Search returned ${response.status}` };
    }

    const html = await response.text();
    const $ = load(html);
    const urls: string[] = [];
    const seen = new Set<string>();

    $('a.result__a').each((_, el) => {
      const href = $(el).attr('href');
      const target = href ? extractTargetUrl(href) : null;
      if (target && !seen.has(target)) {
        seen.add(target);
        urls.push(target);
      }
    });

    return { ok: true, urls };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : 'Search request failed' };
  } finally {
    clearTimeout(timeout);
  }
}

export async function findDiscussion(companyName: string, roleTitle?: string): Promise<DiscussionResult> {
  const snippets: DiscussionResult['snippets'] = [];
  const failed: DiscussionResult['failed'] = [];

  const candidateUrls: string[] = [];
  const seenCandidates = new Set<string>();

  for (const query of buildQueries(companyName, roleTitle)) {
    const result = await searchDuckDuckGo(query);

    if (!result.ok) {
      failed.push({ source: query, reason: result.reason });
      continue;
    }

    for (const url of result.urls) {
      if (isSubstantiveSource(url) && !seenCandidates.has(url)) {
        seenCandidates.add(url);
        candidateUrls.push(url);
      }
    }
  }

  const toFetch = candidateUrls.slice(0, MAX_PAGE_FETCHES);

  for (const url of toFetch) {
    const page = await fetchPage(url);
    if (!page.ok) {
      failed.push({ source: url, reason: page.reason });
      continue;
    }
    snippets.push({ url: page.finalUrl, text: cleanText(page.html) });
  }

  if (snippets.length === 0 && failed.length === 0) {
    failed.push({ source: companyName, reason: 'No discussion results found' });
  }

  return { snippets, failed };
}
