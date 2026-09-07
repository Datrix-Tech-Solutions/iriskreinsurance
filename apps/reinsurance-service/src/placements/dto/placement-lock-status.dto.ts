import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export type PlacementFinancialLockSource =
  | 'NONE'
  | 'PREMIUM_PAYMENT'
  | 'REINSURER_PAYMENT'
  | 'CLAIM_SETTLEMENT'
  | 'STATUS_TERMINAL'
  | 'DOWNSTREAM_ACTIVITY'
  | 'ARCHIVED';

export class PlacementLockStatusDto {
  @ApiProperty({
    example: true,
    description:
      'Whether the placement can be directly mutated without an endorsement.',
  })
  editable!: boolean;

  @ApiProperty({
    example: false,
    description:
      'True only when financial activity has hard-locked the placement.',
  })
  locked!: boolean;

  @ApiProperty({
    example: false,
    description:
      'Whether future business changes must be routed through an endorsement.',
  })
  endorsementRequired!: boolean;

  @ApiProperty({
    example: 'Placement has no financial activity and can be edited.',
  })
  reason!: string;

  @ApiPropertyOptional({
    enum: [
      'NONE',
      'PREMIUM_PAYMENT',
      'REINSURER_PAYMENT',
      'CLAIM_SETTLEMENT',
      'STATUS_TERMINAL',
      'DOWNSTREAM_ACTIVITY',
      'ARCHIVED',
    ],
    example: 'NONE',
    description:
      'High-level source of the lock decision. No financial internals are exposed.',
  })
  lockSource?: PlacementFinancialLockSource;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    example: '2026-06-04T12:00:00.000Z',
    description:
      'Timestamp of the financial activity that locked the placement, when known.',
  })
  lockedAt?: string;

  @ApiProperty({
    example: true,
    description:
      'Alias for editable used by clients that distinguish direct editing from financial locking.',
  })
  canEdit!: boolean;

  @ApiPropertyOptional({
    example: 'Confirmed closing exists.',
    description:
      'Specific business reason direct editing is blocked, when available.',
  })
  editBlockedReason?: string;

  @ApiProperty({
    example: false,
    description:
      'Whether the user should use an endorsement instead of direct placement editing.',
  })
  editRequiresEndorsement!: boolean;
}
