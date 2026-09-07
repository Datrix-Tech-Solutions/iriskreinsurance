import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProcessReinsuranceAccountingOutboxDto {
  @ApiPropertyOptional({ example: 25, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class ReconcileDebitNoteAccountingEventsDto extends ProcessReinsuranceAccountingOutboxDto {
  @ApiPropertyOptional({
    default: true,
    description:
      'When true, reports missing outbox rows without enqueueing them.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === true || value === 'true') return true;
    if (value === false || value === 'false') return false;
    return value;
  })
  @IsBoolean()
  dryRun?: boolean = true;
}

export class ReconcilePaymentAccountingEventsDto extends ReconcileDebitNoteAccountingEventsDto {}

export class AccountingOutboxDispatcherConfigDto {
  @ApiProperty({ example: true })
  enabled!: boolean;

  @ApiProperty({ example: 10000 })
  pollIntervalMs!: number;

  @ApiProperty({ example: 25 })
  batchSize!: number;

  @ApiProperty({ example: 900000 })
  processingTimeoutMs!: number;

  @ApiProperty({ example: 60000 })
  retryDelayMs!: number;

  @ApiProperty({ example: 10 })
  maxAttempts!: number;
}

export class AccountingOutboxDispatcherBatchSummaryDto {
  @ApiProperty({ example: 3 })
  processedCount!: number;

  @ApiProperty({ example: 2 })
  deliveredCount!: number;

  @ApiProperty({ example: 1 })
  failedCount!: number;

  @ApiProperty({ example: 0 })
  skippedCount!: number;
}

export class AccountingOutboxDispatcherStatusDto {
  @ApiProperty({
    example: true,
    description:
      'Whether automatic dispatch is enabled by service configuration.',
  })
  enabled!: boolean;

  @ApiProperty({
    example: true,
    description:
      'Whether this service instance currently owns an active timer.',
  })
  running!: boolean;

  @ApiProperty({
    example: false,
    description: 'Whether a batch is currently being processed.',
  })
  inFlight!: boolean;

  @ApiProperty({ type: AccountingOutboxDispatcherConfigDto })
  config!: AccountingOutboxDispatcherConfigDto;

  @ApiPropertyOptional({
    example: '2026-08-05T12:00:00.000Z',
    nullable: true,
  })
  startedAt!: string | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  stoppedAt!: string | null;

  @ApiPropertyOptional({
    example: '2026-08-05T12:00:10.000Z',
    nullable: true,
  })
  lastBatchAt!: string | null;

  @ApiPropertyOptional({
    type: AccountingOutboxDispatcherBatchSummaryDto,
    nullable: true,
    description:
      'Summary counts only. Per-event payloads, ids and failure messages are intentionally omitted.',
  })
  lastResult!: AccountingOutboxDispatcherBatchSummaryDto | null;

  @ApiPropertyOptional({
    example: 'Last dispatcher batch failed; see service logs.',
    nullable: true,
    description:
      'Sanitized operational failure marker. Sensitive details remain in service logs only.',
  })
  lastError!: string | null;
}
