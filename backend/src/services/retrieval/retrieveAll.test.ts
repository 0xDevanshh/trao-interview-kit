import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { jest } from '@jest/globals';

jest.unstable_mockModule('./findDiscussion.js', () => ({
  findDiscussion: jest.fn(async () => ({ snippets: [], failed: [] })),
}));

const { retrieveAll } = await import('./retrieveAll.js');

const PAGES: Record<string, string> = {
  '/': `<html><body>
    <a href="/careers/how-we-hire">How we hire</a>
    <a href="/pricing">Pricing</a>
    <a href="https://external.example.com/careers">External careers page</a>
    <a href="mailto:jobs@example.com">Email us</a>
  </body></html>`,
  '/careers/how-we-hire': '<html><body>We interview candidates in three rounds.</body></html>',
  '/pricing': '<html><body>Plans start at $10/month.</body></html>',
};

describe('retrieveAll', () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      const path = (req.url ?? '/').split('?')[0] ?? '/';
      const body = PAGES[path];

      if (!body) {
        res.writeHead(404, { 'content-type': 'text/plain' });
        res.end('not found');
        return;
      }

      res.writeHead(200, { 'content-type': 'text/html' });
      res.end(body);
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('follows relative links on the local server and reports the pages it used', async () => {
    const result = await retrieveAll(baseUrl, 'Acme Corp');

    expect(result.retrieval_failures).toEqual([]);
    expect(new Set(result.pages_used)).toEqual(
      new Set([`${baseUrl}/`, `${baseUrl}/careers/how-we-hire`, `${baseUrl}/pricing`]),
    );
    expect(result.company_pages.some((page) => page.text.includes('three rounds'))).toBe(true);
    expect(result.discussion_snippets).toEqual([]);
  });

  it('reports COMPANY_UNREACHABLE when the homepage itself cannot be fetched', async () => {
    const result = await retrieveAll(`${baseUrl}/does-not-exist`, 'Acme Corp');

    expect(result.company_pages).toEqual([]);
    expect(result.pages_used).toEqual([]);
    expect(result.retrieval_failures).toEqual([
      { url_or_source: `${baseUrl}/does-not-exist`, reason: 'COMPANY_UNREACHABLE' },
    ]);
  });
});
