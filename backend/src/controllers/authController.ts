import type { NextFunction, Request, Response } from 'express';
import type { CookieOptions } from 'express';
import { z } from 'zod';
import { UserModel } from '../models/User.js';
import { comparePassword, hashPassword, signToken, TOKEN_EXPIRY_SECONDS } from '../services/authService.js';

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const COOKIE_NAME = 'token';

function cookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: TOKEN_EXPIRY_SECONDS * 1000,
  };
}

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = credentialsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input' } });
      return;
    }

    const { email, password } = parsed.data;

    const existing = await UserModel.findOne({ email });
    if (existing) {
      res.status(409).json({ error: { code: 'EMAIL_TAKEN', message: 'Email is already registered' } });
      return;
    }

    const passwordHash = await hashPassword(password);
    const user = await UserModel.create({ email, passwordHash });

    const token = signToken({ userId: user.id });
    res.cookie(COOKIE_NAME, token, cookieOptions());

    res.status(201).json({ user: { id: user.id, email: user.email } });
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = credentialsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input' } });
      return;
    }

    const { email, password } = parsed.data;

    const user = await UserModel.findOne({ email });
    if (!user) {
      res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' } });
      return;
    }

    const passwordMatches = await comparePassword(password, user.passwordHash);
    if (!passwordMatches) {
      res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' } });
      return;
    }

    const token = signToken({ userId: user.id });
    res.cookie(COOKIE_NAME, token, cookieOptions());

    res.status(200).json({ user: { id: user.id, email: user.email } });
  } catch (err) {
    next(err);
  }
}

export function logout(_req: Request, res: Response): void {
  res.clearCookie(COOKIE_NAME, cookieOptions());
  res.status(200).json({ success: true });
}

export async function me(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await UserModel.findById(req.userId);
    if (!user) {
      res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'User not found' } });
      return;
    }

    res.status(200).json({ user: { id: user.id, email: user.email } });
  } catch (err) {
    next(err);
  }
}
