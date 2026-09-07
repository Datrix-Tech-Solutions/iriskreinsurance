import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform, TransformFnParams } from 'class-transformer';

function trimUppercaseTransform(params: TransformFnParams): unknown {
  const value: unknown = params.value;
  return typeof value === 'string' ? value.trim().toUpperCase() : value;
}

function trimTransform(params: TransformFnParams): unknown {
  const value: unknown = params.value;
  return typeof value === 'string' ? value.trim() : value;
}

export class ApprovePlacementClaimRecoveryDto {
  @ApiProperty({
    type: Number,
    example: 40000,
    description:
      'Recovery receivable amount formally approved/agreed for this reinsurer allocation.',
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  approvedAmount!: number;

  @ApiPropertyOptional({
    example: 'GHS',
    description:
      'Optional currency override. When supplied it must match the claim/allocation currency.',
  })
  @IsOptional()
  @Transform(trimUppercaseTransform)
  @IsString()
  @MaxLength(3)
  currency?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Optional cash-call reference when the approval relates to a specific issued demand. This is traceability only; approval is not a cash receipt.',
  })
  @IsOptional()
  @IsUUID()
  cashCallId?: string;

  @ApiPropertyOptional({
    example: 'RE-APP-2026-001',
    description: 'External reinsurer approval or agreement reference.',
  })
  @IsOptional()
  @Transform(trimTransform)
  @IsString()
  @MaxLength(120)
  reference?: string;

  @ApiPropertyOptional({
    example: 'Approved by reinsurer after loss-adjuster review.',
  })
  @IsOptional()
  @Transform(trimTransform)
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
