import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  PlacementDocumentStatus,
  PlacementDocumentType,
} from '../../../prisma/generated/client';

export class PlacementDocumentResponseDto {
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
  noteId!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  endorsementId!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  endorsementClosingId!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  claimId!: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  claimCashCallId!: string | null;

  @ApiProperty({
    enum: PlacementDocumentType,
    example: PlacementDocumentType.CLOSING_SLIP,
  })
  type!: PlacementDocumentType;

  @ApiProperty({
    enum: PlacementDocumentStatus,
    example: PlacementDocumentStatus.GENERATED,
  })
  status!: PlacementDocumentStatus;

  @ApiProperty({ example: 'DOC-CS-001' })
  documentNumber!: string;

  @ApiProperty({ example: 1 })
  version!: number;

  @ApiProperty({ example: 'Closing Slip CLO-001' })
  title!: string;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'GHS' })
  currency!: string | null;

  @ApiProperty({
    type: Object,
    description:
      'Immutable source data captured when the document was generated.',
  })
  sourceSnapshot!: Record<string, unknown>;

  @ApiProperty({
    type: Object,
    description:
      'Renderer-ready payload for future PDF generation. PR1 does not render PDFs.',
  })
  renderPayload!: Record<string, unknown>;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'S3',
    description: 'Reserved for future private object storage.',
  })
  storageProvider!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  objectKey!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  fileName!: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'application/pdf',
  })
  mimeType!: string | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  sizeBytes!: number | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  checksum!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, format: 'date-time' })
  generatedAt!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, format: 'date-time' })
  voidedAt!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  voidReason!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  failureReason!: string | null;

  @ApiProperty({ format: 'uuid' })
  createdByUserId!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: string;
}

export class PlacementDocumentListResponseDto {
  @ApiProperty({ type: [PlacementDocumentResponseDto] })
  items!: PlacementDocumentResponseDto[];
}
