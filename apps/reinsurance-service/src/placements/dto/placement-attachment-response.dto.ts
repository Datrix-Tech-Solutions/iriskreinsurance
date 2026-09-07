import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PlacementAttachmentStatus } from '../../../prisma/generated/client';

export class PlacementAttachmentResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  tenantId!: string;

  @ApiProperty({ format: 'uuid' })
  placementId!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  participantId!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  closingId!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  endorsementId!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  endorsementParticipantId!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  endorsementClosingId!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  claimId!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  claimCashCallId!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  paymentId!: string | null;

  @ApiProperty({
    enum: PlacementAttachmentStatus,
    example: PlacementAttachmentStatus.ACTIVE,
  })
  status!: PlacementAttachmentStatus;

  @ApiPropertyOptional({ nullable: true, example: 'Signed policy schedule' })
  title!: string | null;

  @ApiPropertyOptional({
    nullable: true,
    example: 'Cedant-supplied supporting schedule.',
  })
  description!: string | null;

  @ApiProperty({ example: 'policy-schedule.pdf' })
  originalFileName!: string;

  @ApiProperty({ example: 'policy-schedule.pdf' })
  fileName!: string;

  @ApiProperty({ example: 'application/pdf' })
  mimeType!: string;

  @ApiProperty({ example: 123456 })
  sizeBytes!: number;

  @ApiProperty({ example: 'sha256-hex-checksum' })
  checksum!: string;

  @ApiProperty({ example: 'S3' })
  storageProvider!: string;

  @ApiProperty({
    example:
      'reinsurance/tenants/tenant-id/placements/placement-id/attachments/placement/attachment-id/file.pdf',
  })
  objectKey!: string;

  @ApiPropertyOptional({ type: String, nullable: true, format: 'date-time' })
  voidedAt!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  voidReason!: string | null;

  @ApiProperty({ format: 'uuid' })
  createdByUserId!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: string;
}

export class PlacementAttachmentListResponseDto {
  @ApiProperty({ type: [PlacementAttachmentResponseDto] })
  items!: PlacementAttachmentResponseDto[];
}
