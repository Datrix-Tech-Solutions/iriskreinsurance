import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  PostingDirection,
  SourceEventStatus,
  SubledgerType,
} from '../../../prisma/generated/client';

const trimmed = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const uppercase = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

const sourcePath = /^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)*$/;

export class PostingRuleLineInputDto {
  @ApiProperty({ example: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sequence!: number;

  @ApiProperty({ enum: PostingDirection, example: PostingDirection.DR })
  @IsEnum(PostingDirection)
  direction!: PostingDirection;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  glAccountId!: string;

  @ApiPropertyOptional({ enum: SubledgerType })
  @IsOptional()
  @IsEnum(SubledgerType)
  subledgerType?: SubledgerType;

  @ApiPropertyOptional({
    example: 'counterparty.id',
    description:
      'Payload path used to find the tenant subledger external reference.',
  })
  @ValidateIf(
    (line: PostingRuleLineInputDto) =>
      line.subledgerType !== undefined ||
      line.subledgerExternalRefSource !== undefined,
  )
  @Transform(trimmed)
  @IsString()
  @MaxLength(200)
  @Matches(sourcePath, { message: 'subledgerExternalRefSource is invalid' })
  subledgerExternalRefSource?: string;

  @ApiProperty({
    example: 'amounts.netPremium',
    description: 'Dot-separated path within the source event payload.',
  })
  @Transform(trimmed)
  @IsString()
  @MaxLength(200)
  @Matches(sourcePath, { message: 'amountSource is invalid' })
  amountSource!: string;

  @ApiProperty({
    example: 'currency',
    description: 'Dot-separated path within the source event payload.',
  })
  @Transform(trimmed)
  @IsString()
  @MaxLength(200)
  @Matches(sourcePath, { message: 'currencySource is invalid' })
  currencySource!: string;

  @ApiProperty({
    example: 'Premium receivable for {{sourceRecordId}}',
    description:
      'Supports sourceRecordId, sourceDocumentId and payload paths such as {{payload.policyNumber}}.',
  })
  @Transform(trimmed)
  @IsString()
  @MaxLength(500)
  descriptionTemplate!: string;
}

export class CreatePostingRuleDto {
  @ApiProperty({ example: 'Premium debit note issued' })
  @Transform(trimmed)
  @IsString()
  @MaxLength(160)
  name!: string;

  @ApiProperty({ example: 'REINSURANCE' })
  @Transform(uppercase)
  @IsString()
  @MaxLength(80)
  sourceModule!: string;

  @ApiProperty({ example: 'DEBIT_NOTE_ISSUED' })
  @Transform(uppercase)
  @IsString()
  @MaxLength(100)
  sourceEventType!: string;

  @ApiProperty({ example: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;

  @ApiPropertyOptional({
    default: false,
    description: 'Active rules require at least two configured lines.',
  })
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  @IsDateString()
  effectiveFrom!: string;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @IsDateString()
  effectiveTo?: string;

  @ApiPropertyOptional({
    type: [PostingRuleLineInputDto],
    minItems: 2,
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => PostingRuleLineInputDto)
  lines?: PostingRuleLineInputDto[];
}

export class UpdatePostingRuleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(160)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @IsDateString()
  effectiveTo?: string;
}

export class CreatePostingRuleLineDto extends PostingRuleLineInputDto {}

export class UpdatePostingRuleLineDto extends PartialType(
  PostingRuleLineInputDto,
) {}

export class QueryPostingRulesDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(uppercase)
  @IsString()
  @MaxLength(80)
  sourceModule?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(uppercase)
  @IsString()
  @MaxLength(100)
  sourceEventType?: string;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === true || value === 'true') return true;
    if (value === false || value === 'false') return false;
    return value;
  })
  @IsBoolean()
  active?: boolean;
}

export class CreateSourceEventDto {
  @ApiProperty({ example: 'REINSURANCE' })
  @Transform(uppercase)
  @IsString()
  @MaxLength(80)
  sourceModule!: string;

  @ApiProperty({ example: 'DEBIT_NOTE_ISSUED' })
  @Transform(uppercase)
  @IsString()
  @MaxLength(100)
  sourceEventType!: string;

  @ApiProperty({ example: 'note-uuid' })
  @Transform(trimmed)
  @IsString()
  @MaxLength(100)
  sourceRecordId!: string;

  @ApiPropertyOptional({ example: 'document-uuid' })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(100)
  sourceDocumentId?: string;

  @ApiProperty({ example: 'reinsurance:debit-note:note-uuid:issued:v1' })
  @Transform(trimmed)
  @IsString()
  @MaxLength(160)
  idempotencyKey!: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    example: {
      transactionDate: '2026-07-05T10:00:00.000Z',
      currency: 'GHS',
      amounts: { netPremium: 12500 },
      counterparty: { id: 'cedant-uuid' },
      policyNumber: 'POL-2026-001',
    },
  })
  @IsObject()
  payload!: Record<string, unknown>;
}

export class InternalSourceEventDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  tenantId!: string;

  @ApiProperty({ example: 'REINSURANCE' })
  @Transform(uppercase)
  @IsString()
  @MaxLength(80)
  sourceModule!: string;

  @ApiProperty({ example: 'DEBIT_NOTE_ISSUED' })
  @Transform(uppercase)
  @IsString()
  @MaxLength(100)
  sourceEventType!: string;

  @ApiProperty({ example: 'note-uuid' })
  @Transform(trimmed)
  @IsString()
  @MaxLength(100)
  sourceRecordId!: string;

  @ApiPropertyOptional({ example: 'document-uuid' })
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(100)
  sourceDocumentId?: string;

  @ApiProperty({ example: 'reinsurance:debit-note:note-uuid:issued:v1' })
  @Transform(trimmed)
  @IsString()
  @MaxLength(160)
  idempotencyKey!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  @IsDateString()
  occurredAt!: string;

  @ApiProperty({ example: 'GHS', minLength: 3, maxLength: 3 })
  @Transform(uppercase)
  @IsString()
  @Length(3, 3)
  currency!: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    example: {
      amounts: { netPremium: 12500 },
      counterparty: { id: 'cedant-uuid' },
      policyNumber: 'POL-2026-001',
    },
  })
  @IsObject()
  payload!: Record<string, unknown>;
}

export class InternalReinsuranceAccountingReadinessDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  tenantId!: string;

  @ApiProperty({
    type: [String],
    example: ['CLAIM_PAYABLE_APPROVED', 'CLAIM_CEDANT_SETTLEMENT_PAID'],
    minItems: 1,
  })
  @IsArray()
  @ArrayMinSize(1)
  @Transform(({ value }: { value: unknown }): unknown => {
    if (!Array.isArray(value)) return value;
    return (value as unknown[]).map((item): unknown =>
      typeof item === 'string' ? item.trim().toUpperCase() : item,
    );
  })
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  eventTypes!: string[];

  @ApiPropertyOptional({ example: 'GHS', minLength: 3, maxLength: 3 })
  @IsOptional()
  @Transform(uppercase)
  @IsString()
  @Length(3, 3)
  currency?: string;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @IsDateString()
  businessDate?: string;

  @ApiPropertyOptional({
    example: 'BANK_TRANSFER',
    description:
      'Source settlement method. Cash account readiness is skipped for INTERNAL_OFFSET and JOURNAL.',
  })
  @IsOptional()
  @Transform(uppercase)
  @IsString()
  @MaxLength(40)
  settlementMethod?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  accountingCashAccountId?: string;
}

export class ReinsuranceAccountingReadinessBlockerDto {
  @ApiProperty({
    example: 'POSTING_RULE_MISSING',
    description: 'Stable blocker code safe for UI/support handling.',
  })
  code!: string;

  @ApiProperty({
    example: 'No PostingRule is configured for CLAIM_PAYABLE_APPROVED.',
  })
  message!: string;
}

export class ReinsuranceAccountingEventReadinessDto {
  @ApiProperty({ example: 'CLAIM_PAYABLE_APPROVED' })
  eventType!: string;

  @ApiProperty({ example: false })
  ready!: boolean;

  @ApiProperty({ example: 'NON_CASH', nullable: true })
  kind!: string | null;

  @ApiProperty({ example: 'CEDANT_CLAIMS_AP', nullable: true })
  controlDimension!: string | null;

  @ApiProperty({ example: 'CEDANT', nullable: true })
  requiredSubledgerType!: string | null;

  @ApiProperty({ example: false })
  reversalDependsOnOriginalRecognition!: boolean;

  @ApiProperty({ type: [ReinsuranceAccountingReadinessBlockerDto] })
  blockers!: ReinsuranceAccountingReadinessBlockerDto[];
}

export class ReinsuranceAccountingReadinessResponseDto {
  @ApiProperty({ example: false })
  ready!: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  checkedAt!: string;

  @ApiProperty({ type: [ReinsuranceAccountingEventReadinessDto] })
  eventResults!: ReinsuranceAccountingEventReadinessDto[];
}

export class QuerySourceEventsDto {
  @ApiPropertyOptional({ enum: SourceEventStatus })
  @IsOptional()
  @IsEnum(SourceEventStatus)
  status?: SourceEventStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(uppercase)
  @IsString()
  @MaxLength(80)
  sourceModule?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(uppercase)
  @IsString()
  @MaxLength(100)
  sourceEventType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimmed)
  @IsString()
  @MaxLength(100)
  sourceRecordId?: string;
}

export class ProcessPendingSourceEventsDto {
  @ApiPropertyOptional({
    example: 25,
    minimum: 1,
    maximum: 100,
    default: 25,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ example: 'REINSURANCE' })
  @IsOptional()
  @Transform(uppercase)
  @IsString()
  @MaxLength(80)
  sourceModule?: string;

  @ApiPropertyOptional({ example: 'DEBIT_NOTE_ISSUED' })
  @IsOptional()
  @Transform(uppercase)
  @IsString()
  @MaxLength(100)
  sourceEventType?: string;
}
