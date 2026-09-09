import { crawlCompanySite, type CrawlResult } from './crawlSite.js';
import { findDiscussion, type DiscussionResult } from './findDiscussion.js';

export interface RetrieveAllResult {
  pages_used: string[];
  company_pages: { url: string; text: string }[];
  discussion_snippets: { url: string; text: string }[];
  retrieval_failures: { url_or_source: string; reason: string }[];
}

function toErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Unexpected error';
}

async function safeCrawl(companyUrl: string): Promise<CrawlResult> {
  try {
    return await crawlCompanySite(companyUrl);
  } catch (err) {
    return { pages: [], attempted: [companyUrl], failed: [{ url: companyUrl, reason: toErrorMessage(err) }] };
  }
}

async function safeFindDiscussion(companyName: string, roleTitle?: string): Promise<DiscussionResult> {
  try {
    return await findDiscussion(companyName, roleTitle);
  } catch (err) {
    return { snippets: [], failed: [{ source: companyName, reason: toErrorMessage(err) }] };
  }
}

export async function retrieveAll(
  companyUrl: string,
  companyName: string,
  roleTitle?: string,
): Promise<RetrieveAllResult> {
  const [crawlResult, discussionResult] = await Promise.all([
    safeCrawl(companyUrl),
    safeFindDiscussion(companyName, roleTitle),
  ]);

  const retrieval_failures: RetrieveAllResult['retrieval_failures'] = [];

  // crawlSite's pages array is empty only when the homepage itself never
  // loaded — i.e. nothing on the company's site was reachable at all. That
  // gets a stable, checkable sentinel reason so the pipeline downstream can
  // branch on "produce an honest thin kit" without string-matching arbitrary
  // network error text.
  const companyUnreachable = crawlResult.pages.length === 0;

  for (const failure of crawlResult.failed) {
    retrieval_failures.push({
      url_or_source: failure.url,
      reason: companyUnreachable && failure.url === companyUrl ? 'COMPANY_UNREACHABLE' : failure.reason,
    });
  }

  for (const failure of discussionResult.failed) {
    retrieval_failures.push({ url_or_source: failure.source, reason: failure.reason });
  }

  const pages_used = Array.from(
    new Set([
      ...crawlResult.pages.map((page) => page.url),
      ...discussionResult.snippets.map((snippet) => snippet.url),
    ]),
  );

  return {
    pages_used,
    company_pages: crawlResult.pages,
    discussion_snippets: discussionResult.snippets,
    retrieval_failures,
  };
}
