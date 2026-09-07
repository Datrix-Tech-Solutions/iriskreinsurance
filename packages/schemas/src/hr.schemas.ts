import { z } from 'zod';
import { EmploymentType } from '@work-phelo/types';

export const CreateEmployeeSchema = z.object({
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  email: z.string().email(),
  departmentId: z.string().uuid(),
  jobTitleId: z.string().uuid(),
  managerId: z.string().uuid().optional(),
  employmentType: z.nativeEnum(EmploymentType),
  startDate: z.string().datetime(),
  salary: z.number().positive(),
});

export const CreateLeaveRequestSchema = z.object({
  leaveTypeId: z.string().uuid(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  notes: z.string().max(500).optional(),
});

export type CreateEmployeeDto = z.infer<typeof CreateEmployeeSchema>;
export type CreateLeaveRequestDto = z.infer<typeof CreateLeaveRequestSchema>;
