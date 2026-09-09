import { load } from 'cheerio';

const REMOVE_SELECTORS = [
  'script',
  'style',
  'noscript',
  'template',
  'nav',
  'footer',
  '[hidden]',
  '[aria-hidden="true"]',
  'input[type="hidden"]',
  '[style*="display:none"]',
  '[style*="display: none"]',
  '[style*="visibility:hidden"]',
  '[style*="visibility: hidden"]',
].join(', ');

/**
 * Extracts readable text from a page's HTML. This output is later
 * concatenated into an LLM prompt, so it strips anything that isn't
 * genuinely visible page content — HTML comments and hidden elements are
 * common places to hide text that isn't meant to be read as "the page",
 * and we don't want that surfacing as if it were an instruction.
 */
export function cleanText(html: string): string {
  const $ = load(html);

  $('*')
    .contents()
    .each((_, node) => {
      if (node.type === 'comment') {
        $(node).remove();
      }
    });

  $(REMOVE_SELECTORS).remove();

  const body = $('body');
  const text = body.length ? body.text() : $.root().text();

  return text.replace(/\s+/g, ' ').trim();
}
