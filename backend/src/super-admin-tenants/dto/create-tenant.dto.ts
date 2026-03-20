import { z } from 'zod';

export const createTenantSchema = z.object({
  client_name: z.string().min(1).max(255),
  client_slug: z
    .string()
    .min(1)
    .max(24)
    .regex(
      /^[a-z0-9_]+$/,
      'client_slug: lowercase letters, digits, underscore only (max 24)',
    ),
  timezone: z.string().min(1).max(64),
  notes: z.string().max(4000).optional(),
  plan: z.string().max(64).optional(),
});

export type CreateTenantInput = z.infer<typeof createTenantSchema>;

export const patchTenantLifecycleSchema = z.object({
  status: z.enum(['active', 'inactive']),
});

export type PatchTenantLifecycleInput = z.infer<
  typeof patchTenantLifecycleSchema
>;
