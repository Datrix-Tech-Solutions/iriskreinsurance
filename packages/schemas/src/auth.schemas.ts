import { z } from 'zod';

export const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  mfaCode: z.string().length(6).optional(),
});

export const RegisterTenantSchema = z.object({
  companyName: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8),
  country: z.string().length(2),
  phone: z.string().min(10),
});

export type LoginDto = z.infer<typeof LoginSchema>;
export type RegisterTenantDto = z.infer<typeof RegisterTenantSchema>;
