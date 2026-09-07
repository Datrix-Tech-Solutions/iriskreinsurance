import {
  IsString,
  IsInt,
  IsBoolean,
  IsOptional,
  Min,
  IsEnum,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EmploymentType, Gender } from '../../../prisma/generated/client';

export class CreateLeaveTypeDto {
  @ApiProperty({
    description: 'Name of the leave type',
    example: 'Annual Leave',
  })
  @IsString()
  name!: string;

  @ApiProperty({ description: 'Allowed number of days per year', example: 21 })
  @IsInt()
  @Min(1)
  daysAllowed!: number;

  @ApiPropertyOptional({
    description: 'Whether unused days can carry over',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isCarryOver?: boolean;

  @ApiPropertyOptional({
    description: 'Maximum number of carry-over days',
    example: 5,
  })
  @IsOptional()
  @IsInt()
  maxCarryOverDays?: number;

  @ApiPropertyOptional({
    description:
      'Deprecated operational flag. Leave requests are now always reviewed before approval.',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  requiresApproval?: boolean;

  @ApiPropertyOptional({
    description:
      'Whether a supporting document must be attached before this leave can be approved',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  requiresSupportingDocument?: boolean;

  @ApiPropertyOptional({
    description: 'Whether this leave type is paid',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isPaid?: boolean;

  @ApiPropertyOptional({
    description:
      'Employment types eligible for this leave. Empty array means all types are eligible.',
    enum: EmploymentType,
    isArray: true,
    example: ['FULL_TIME', 'CONTRACT'],
  })
  @IsOptional()
  @IsEnum(EmploymentType, { each: true })
  applicableTo?: EmploymentType[];

  @ApiPropertyOptional({
    description:
      'Genders eligible for this leave. Empty array means all genders are eligible.',
    enum: Gender,
    isArray: true,
    example: ['FEMALE'],
  })
  @IsOptional()
  @IsEnum(Gender, { each: true })
  applicableGenders?: Gender[];
}
