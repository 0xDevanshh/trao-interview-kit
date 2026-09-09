import { fetch } from 'undici';
import robotsParserImport from 'robots-parser';

interface Robot {
  isAllowed(url: string, ua?: string): boolean | undefined;
}

// robots-parser's bundled .d.ts ships a stray ambient `declare module` that
// shadows its real default export, so TS sees it as non-callable. The runtime
// export is a plain function; this restores that type.
const robotsParser = robotsParserImport as unknown as (url: string, robotstxt: string) => Robot;

const USER_AGENT = 'TraoInterviewKitBot';
const ROBOTS_FETCH_TIMEOUT_MS = 5000;

const robotsCache = new Map<string, Promise<Robot | null>>();

async function fetchRobot(origin: string): Promise<Robot | null> {
  const robotsUrl = `${origin}/robots.txt`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ROBOTS_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(robotsUrl, { signal: controller.signal });
    if (!response.ok) {
      // Missing/unreachable robots.txt defaults to fully allowed.
      return null;
    }
    const text = await response.text();
    return robotsParser(robotsUrl, text);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function isAllowed(url: string): Promise<boolean> {
  let origin: string;
  try {
    origin = new URL(url).origin;
  } catch {
    return false;
  }

  let robotPromise = robotsCache.get(origin);
  if (!robotPromise) {
    robotPromise = fetchRobot(origin);
    robotsCache.set(origin, robotPromise);
  }

  const robot = await robotPromise;
  if (!robot) {
    return true;
  }

  return robot.isAllowed(url, USER_AGENT) ?? true;
}
