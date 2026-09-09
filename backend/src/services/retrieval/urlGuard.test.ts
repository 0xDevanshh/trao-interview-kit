import { validateUrl } from './urlGuard.js';

describe('validateUrl', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('allows a public URL regardless of environment', () => {
    process.env.NODE_ENV = 'production';
    expect(validateUrl('https://example.com/careers').ok).toBe(true);

    process.env.NODE_ENV = 'development';
    expect(validateUrl('https://example.com/careers').ok).toBe(true);
  });

  it('rejects localhost in production but allows it outside production', () => {
    process.env.NODE_ENV = 'production';
    const inProd = validateUrl('http://localhost:3000/jobs');
    expect(inProd.ok).toBe(false);

    process.env.NODE_ENV = 'development';
    const outsideProd = validateUrl('http://localhost:3000/jobs');
    expect(outsideProd.ok).toBe(true);
  });

  it('rejects a private IP in production but allows it outside production', () => {
    process.env.NODE_ENV = 'production';
    const inProd = validateUrl('http://10.0.0.5/jobs');
    expect(inProd.ok).toBe(false);

    process.env.NODE_ENV = 'development';
    const outsideProd = validateUrl('http://10.0.0.5/jobs');
    expect(outsideProd.ok).toBe(true);
  });

  it('rejects a bare public IP literal regardless of environment', () => {
    process.env.NODE_ENV = 'production';
    expect(validateUrl('http://8.8.8.8/jobs').ok).toBe(false);

    process.env.NODE_ENV = 'development';
    expect(validateUrl('http://8.8.8.8/jobs').ok).toBe(false);
  });

  it('rejects unsupported protocols', () => {
    expect(validateUrl('ftp://example.com/file').ok).toBe(false);
  });

  it('rejects malformed URLs', () => {
    expect(validateUrl('not a url').ok).toBe(false);
  });
});
