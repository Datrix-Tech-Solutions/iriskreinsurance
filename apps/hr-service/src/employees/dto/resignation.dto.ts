import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ResignationReasonDto {
  PERSONAL_REASONS = 'PERSONAL_REASONS',
  BETTER_OPPORTUNITY = 'BETTER_OPPORTUNITY',
  RELOCATION = 'RELOCATION',
  FURTHER_EDUCATION = 'FURTHER_EDUCATION',
  HEALTH_REASONS = 'HEALTH_REASONS',
  OTHER = 'OTHER',
}

export class SubmitResignationDto {
  @ApiProperty({
    example: '2026-06-30',
    description: 'Last working date. Must meet the company notice period.',
  })
  @IsDateString()
  lastWorkingDate!: string;

  @ApiPropertyOptional({
    enum: ResignationReasonDto,
    description: 'Optional reason for leaving',
  })
  @IsOptional()
  @IsEnum(ResignationReasonDto)
  reason?: ResignationReasonDto;

  @ApiPropertyOptional({
    description: 'Additional notes for HR',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  additionalNotes?: string;
}

export class DismissResignationDto {
  @ApiPropertyOptional({
    description: 'Optional note recorded when dismissing the resignation',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
