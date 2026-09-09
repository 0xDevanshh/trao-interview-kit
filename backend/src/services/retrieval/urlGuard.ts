import net from 'node:net';

export interface UrlValidationResult {
  ok: boolean;
  reason?: string;
}

function isRestrictedIPv4(ip: string): boolean {
  const parts = ip.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
    return false;
  }
  const [a, b] = parts as [number, number, number, number];

  if (a === 127) return true; // 127.0.0.0/8 loopback
  if (a === 10) return true; // 10.0.0.0/8 private
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 private
  if (a === 192 && b === 168) return true; // 192.168.0.0/16 private
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local

  return false;
}

function isRestrictedIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (normalized === '::1') return true; // loopback

  const firstGroup = normalized.split(':')[0] ?? '';
  return firstGroup.startsWith('fc') || firstGroup.startsWith('fd'); // fc00::/7 unique local
}

function stripBrackets(hostname: string): string {
  return hostname.replace(/^\[|\]$/g, '');
}

export function validateUrl(url: string): UrlValidationResult {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, reason: 'Malformed URL' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, reason: `Unsupported protocol "${parsed.protocol}"` };
  }

  const hostname = stripBrackets(parsed.hostname);
  if (!hostname) {
    return { ok: false, reason: 'URL is missing a hostname' };
  }

  const isProduction = process.env.NODE_ENV === 'production';
  const ipVersion = net.isIP(hostname);

  const isRestricted =
    hostname.toLowerCase() === 'localhost' ||
    (ipVersion === 4 && isRestrictedIPv4(hostname)) ||
    (ipVersion === 6 && isRestrictedIPv6(hostname));

  if (isRestricted) {
    if (isProduction) {
      return { ok: false, reason: 'Private/loopback/link-local addresses are not allowed in production' };
    }
    return { ok: true };
  }

  if (ipVersion !== 0) {
    // A bare public IP literal has no legitimate reason to be a target here;
    // real job/company pages are always reached by hostname.
    return { ok: false, reason: 'Bare IP addresses are not allowed' };
  }

  return { ok: true };
}
