import { z } from 'zod';

const optionalHttpUrl = z
  .string()
  .max(512)
  .optional()
  .refine(
    (s) =>
      s === undefined ||
      String(s).trim() === '' ||
      /^https?:\/\/.+/i.test(String(s).trim()),
    { message: 'api_public_url must be empty or a valid http(s) URL' },
  );

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
  api_public_url: optionalHttpUrl,
  environment: z.string().trim().max(32).optional(),
});

export type CreateTenantInput = z.infer<typeof createTenantSchema>;

/** PATCH body: lifecycle and/or registry metadata (super-admin control plane). */
export const patchTenantSchema = z
  .object({
    status: z.enum(['active', 'inactive']).optional(),
    api_public_url: optionalHttpUrl,
    environment: z.string().trim().max(32).optional(),
  })
  .refine(
    (d) =>
      d.status !== undefined ||
      d.api_public_url !== undefined ||
      d.environment !== undefined,
    { message: 'Send at least one of: status, api_public_url, environment' },
  );

export type PatchTenantInput = z.infer<typeof patchTenantSchema>;

/** @deprecated use patchTenantSchema */
export const patchTenantLifecycleSchema = z.object({
  status: z.enum(['active', 'inactive']),
});

export type PatchTenantLifecycleInput = z.infer<
  typeof patchTenantLifecycleSchema
>;
