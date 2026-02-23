import { z } from "zod";

const isoWeekRegex = /^\d{4}-W(0[1-9]|[1-4][0-9]|5[0-3])$/;

export const authPayloadSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(128),
});

export const boardCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional().nullable(),
});

export const boardUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(500).optional().nullable(),
  version: z.number().int().positive(),
});

export const moduleCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
});

export const moduleUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  version: z.number().int().positive(),
});

export const cardCreateSchema = z.object({
  moduleId: z.string().min(1),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).optional().nullable(),
  priorityLane: z.enum(["skeleton", "mvp", "lovable"]),
  effort: z.enum(["xs", "s", "m", "l", "xl"]).default("m"),
  weekTarget: z
    .string()
    .trim()
    .regex(isoWeekRegex)
    .optional()
    .nullable()
    .or(z.literal("")),
});

export const cardUpdateSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  effort: z.enum(["xs", "s", "m", "l", "xl"]).optional(),
  weekTarget: z
    .string()
    .trim()
    .regex(isoWeekRegex)
    .optional()
    .nullable()
    .or(z.literal("")),
  version: z.number().int().positive(),
});

export const moveCardSchema = z.object({
  targetModuleId: z.string().min(1),
  targetLane: z.enum(["skeleton", "mvp", "lovable"]),
  targetPosition: z.number().int().min(0),
  version: z.number().int().positive(),
});
