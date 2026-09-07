import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MaxLength,
} from 'class-validator';

const ALLOWANCE_TYPES = [
  'TRANSPORT',
  'HOUSING',
  'MEDICAL',
  'CLOTHING',
  'OTHER',
] as const;

export class CreateEmployeeAllowanceDto {
  @ApiProperty({ enum: ALLOWANCE_TYPES, example: 'TRANSPORT' })
  @IsIn(ALLOWANCE_TYPES)
  type!: string;

  @ApiProperty({ example: 500, minimum: 0.01 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @ApiPropertyOptional({
    example: 'Uniform Allowance',
    description: 'Custom label, used when type is OTHER',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;
}

export class UpdateEmployeeAllowanceDto {
  @ApiPropertyOptional({ enum: ALLOWANCE_TYPES, example: 'TRANSPORT' })
  @IsOptional()
  @IsIn(ALLOWANCE_TYPES)
  type?: string;

  @ApiPropertyOptional({ example: 600, minimum: 0.01 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount?: number;

  @ApiPropertyOptional({
    example: 'Uniform Allowance',
    description: 'Custom label, used when type is OTHER',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;
}
