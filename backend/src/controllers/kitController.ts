import type { NextFunction, Request, Response } from 'express';
import { isValidObjectId } from 'mongoose';
import { z } from 'zod';
import { KitModel, type KitDocument } from '../models/Kit.js';
import { validateKitStructure } from '../schemas/kitValidation.js';
import type { Kit } from '../schemas/kitSchema.js';

const createKitSchema = z.object({
  jd: z.string().min(1),
  company_url: z.string().min(1),
  days: z.number().int().positive(),
});

const KIT_BODY_KEYS = [
  'source',
  'company_brief',
  'role',
  'questions',
  'flashcards',
  'schedule',
  'coverage',
] as const;

type KitBodyKey = (typeof KIT_BODY_KEYS)[number];

function buildPlaceholderKitBody(jd: string, companyUrl: string, days: number): Kit {
  return {
    source: {
      company: '',
      company_url: companyUrl,
      role: '',
      location: '',
      jd_chars: jd.length,
      researched_at: new Date().toISOString(),
      pages_used: [],
    },
    company_brief: {
      summary: '',
      what_they_do: '',
      sources: [],
    },
    role: {
      title: '',
      seniority: '',
      responsibilities: [],
      requirements: [],
    },
    questions: [],
    flashcards: [],
    schedule: {
      days_available: days,
      days: [],
    },
    coverage: {
      uncovered_requirement_ids: [],
      passes: 0,
    },
  };
}

function serializeKit(kit: KitDocument & { _id: unknown }) {
  return {
    id: String(kit._id),
    status: kit.status,
    createdAt: kit.createdAt,
    updatedAt: kit.updatedAt,
    source: kit.source,
    company_brief: kit.company_brief,
    role: kit.role,
    questions: kit.questions,
    flashcards: kit.flashcards,
    schedule: kit.schedule,
    coverage: kit.coverage,
  };
}

export async function createKit(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const ownerId = req.userId;
    if (!ownerId) {
      res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'No token provided' } });
      return;
    }

    const parsed = createKitSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input' },
      });
      return;
    }

    const { jd, company_url, days } = parsed.data;
    const body = buildPlaceholderKitBody(jd, company_url, days);

    const kit = await KitModel.create({
      ownerId,
      status: 'draft',
      ...body,
    });

    res.status(201).json({ kit: serializeKit(kit) });
  } catch (err) {
    next(err);
  }
}

export async function listKits(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const ownerId = req.userId;
    if (!ownerId) {
      res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'No token provided' } });
      return;
    }

    const kits = await KitModel.find({ ownerId })
      .select('status createdAt source.role role.title')
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      kits: kits.map((kit) => ({
        id: String(kit._id),
        title: kit.source?.role || kit.role?.title || 'Untitled kit',
        status: kit.status,
        createdAt: kit.createdAt,
      })),
    });
  } catch (err) {
    next(err);
  }
}

export async function getKit(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const ownerId = req.userId;
    if (!ownerId) {
      res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'No token provided' } });
      return;
    }

    const { id } = req.params;
    if (!id || !isValidObjectId(id)) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Kit not found' } });
      return;
    }

    const kit = await KitModel.findById(id);
    if (!kit || kit.ownerId.toString() !== ownerId) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Kit not found' } });
      return;
    }

    res.status(200).json({ kit: serializeKit(kit) });
  } catch (err) {
    next(err);
  }
}

export async function deleteKit(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const ownerId = req.userId;
    if (!ownerId) {
      res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'No token provided' } });
      return;
    }

    const { id } = req.params;
    if (!id || !isValidObjectId(id)) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Kit not found' } });
      return;
    }

    const kit = await KitModel.findOneAndDelete({ _id: id, ownerId });
    if (!kit) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Kit not found' } });
      return;
    }

    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function patchKit(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const ownerId = req.userId;
    if (!ownerId) {
      res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'No token provided' } });
      return;
    }

    const { id } = req.params;
    if (!id || !isValidObjectId(id)) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Kit not found' } });
      return;
    }

    const kit = await KitModel.findById(id);
    if (!kit || kit.ownerId.toString() !== ownerId) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Kit not found' } });
      return;
    }

    const updates = (req.body ?? {}) as Record<string, unknown>;
    const merged: Record<string, unknown> = {};

    for (const key of KIT_BODY_KEYS) {
      merged[key] = Object.prototype.hasOwnProperty.call(updates, key) ? updates[key] : kit[key];
    }

    const result = validateKitStructure(merged);
    if (!result.valid) {
      res.status(422).json({
        error: { code: 'VALIDATION_ERROR', message: 'Kit failed validation', errors: result.errors },
      });
      return;
    }

    for (const key of KIT_BODY_KEYS) {
      if (Object.prototype.hasOwnProperty.call(updates, key)) {
        (kit as unknown as Record<KitBodyKey, unknown>)[key] = updates[key];
      }
    }

    await kit.save();

    res.status(200).json({ kit: serializeKit(kit) });
  } catch (err) {
    next(err);
  }
}
