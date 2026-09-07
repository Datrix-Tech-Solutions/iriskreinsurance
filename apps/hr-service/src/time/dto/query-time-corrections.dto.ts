import { IsEnum, IsOptional, IsUUID } from 'class-validator';

export enum TimeCorrectionStatusQuery {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export class QueryTimeCorrectionsDto {
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @IsEnum(TimeCorrectionStatusQuery)
  status?: TimeCorrectionStatusQuery;
}
