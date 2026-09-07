import { IsEnum, IsOptional } from 'class-validator';

export enum ManagerShiftSwapStatusQuery {
  PENDING = 'PENDING',
  PENDING_MANAGER = 'PENDING_MANAGER',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export class QueryManagerShiftSwapsDto {
  @IsOptional()
  @IsEnum(ManagerShiftSwapStatusQuery)
  status?: ManagerShiftSwapStatusQuery;
}
