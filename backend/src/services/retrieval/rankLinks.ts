// The signature only takes URLs (no anchor text), so the "anchor-text"
// signal is approximated from the human-readable words in the URL's own
// path segments (e.g. "/careers/how-we-hire" reads much like its own
// anchor text would).

const STRONG_KEYWORDS = new Set([
  'career',
  'careers',
  'job',
  'jobs',
  'hiring',
  'hire',
  'hires',
  'interview',
  'interviews',
  'interviewing',
  'recruit',
  'recruiting',
  'recruitment',
]);

const MEDIUM_KEYWORDS = new Set([
  'join',
  'joinus',
  'culture',
  'team',
  'people',
  'life',
  'lifeat',
  'about',
  'values',
  'benefits',
]);

const STRONG_SCORE = 10;
const MEDIUM_SCORE = 4;
const ENGINEERING_BLOG_BONUS = 6;
const DEPTH_PENALTY = 0.5;

function getPath(link: string): string {
  try {
    return new URL(link).pathname;
  } catch {
    return link;
  }
}

function tokenize(path: string): string[] {
  let decoded = path;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    // Leave as-is if it isn't valid percent-encoding.
  }

  return decoded
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function scoreLink(link: string): number {
  const path = getPath(link);
  const tokens = tokenize(path);
  const tokenSet = new Set(tokens);

  let score = 0;
  for (const token of tokens) {
    if (STRONG_KEYWORDS.has(token)) {
      score += STRONG_SCORE;
    } else if (MEDIUM_KEYWORDS.has(token)) {
      score += MEDIUM_SCORE;
    }
  }

  const isEngineeringBlog =
    (tokenSet.has('engineering') || tokenSet.has('eng')) && tokenSet.has('blog');
  if (isEngineeringBlog) {
    score += ENGINEERING_BLOG_BONUS;
  }

  const depth = path.split('/').filter(Boolean).length;
  score -= depth * DEPTH_PENALTY;

  return score;
}

export function rankHiringLinks(links: string[]): string[] {
  return [...links].sort((a, b) => scoreLink(b) - scoreLink(a));
}
