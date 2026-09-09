import type { NextFunction, Request, Response } from 'express';
import { LLMError } from '../config/groqClient.js';

interface HttpError extends Error {
  status?: number;
  statusCode?: number;
  code?: string;
}

export function errorHandler(err: HttpError, _req: Request, res: Response, _next: NextFunction): void {
  const isProduction = process.env.NODE_ENV === 'production';

  let status = err.status ?? err.statusCode ?? 500;
  let code = err.code ?? 'INTERNAL_ERROR';

  if (err instanceof LLMError) {
    code = err.code;
    status = err.code === 'RATE_LIMITED' ? 429 : 502;
  }

  const message = !isProduction || status < 500 ? err.message || 'An error occurred' : 'Internal server error';

  console.error('[error]', err);

  res.status(status).json({
    error: {
      code,
      message,
    },
  });
}
