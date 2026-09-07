import { z } from 'zod';

export const UpdateTenantSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  logo: z.string().url().optional(),
  subdomain: z.string().min(3).max(50).optional(),
});

export type UpdateTenantDto = z.infer<typeof UpdateTenantSchema>;
