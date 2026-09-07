import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { TrimmedString } from '../../counterparties/dto/string.transforms';

export class CreateRiskTypeDto {
  @ApiProperty({
    format: 'uuid',
    description: 'The risk class this type belongs to.',
  })
  @IsUUID()
  riskClassId!: string;

  @ApiProperty({ example: 'Marine Cargo', minLength: 2, maxLength: 100 })
  @TrimmedString()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({
    example: 'Covers goods transported by sea.',
    maxLength: 500,
  })
  @TrimmedString()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: 0, minimum: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  displayOrder?: number;
}
