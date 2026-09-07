import {
  IsOptional,
  IsString,
  IsEnum,
  IsInt,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  EmploymentStatus,
  EmploymentType,
} from '../../../prisma/generated/client';

export class QueryEmployeesDto {
  @IsOptional() @IsString() @MaxLength(100) search?: string;
  @IsOptional() @IsString() departmentId?: string;
  @IsOptional() @IsEnum(EmploymentStatus) status?: EmploymentStatus;
  @IsOptional() @IsEnum(EmploymentType) type?: EmploymentType;
  @IsOptional() @IsInt() @Min(1) @Type(() => Number) page?: number;
  @IsOptional() @IsInt() @Min(1) @Max(100) @Type(() => Number) limit?: number;
}
