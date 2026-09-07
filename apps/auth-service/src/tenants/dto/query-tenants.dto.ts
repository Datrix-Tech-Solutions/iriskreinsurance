import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export enum TenantStatusQuery {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  CANCELLED = 'CANCELLED',
}

export class QueryTenantsDto {
  @IsOptional()
  @IsEnum(TenantStatusQuery)
  status?: TenantStatusQuery;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
