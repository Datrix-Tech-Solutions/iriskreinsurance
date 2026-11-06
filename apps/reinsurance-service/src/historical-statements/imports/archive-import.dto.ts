import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  MaxLength,
  IsOptional,
  IsUUID,
  Matches,
} from 'class-validator';

export class ArchiveUploadDto {
  @ApiProperty({
    example: '[{"index":0,"kind":"INSURER","year":2021}]',
    description:
      'JSON array with exactly ten index/kind/year descriptors, one of each kind for 2021–2025. No tenant, filename, hash or matching selectors.',
  })
  @IsString()
  @MaxLength(8192)
  metadata!: string;
}
export class ArchivePublishDto {
  @ApiProperty({
    description: 'Exact validated server-generated dataset version.',
  })
  @IsString()
  @MaxLength(128)
  @Matches(/\S/)
  datasetVersion!: string;

  @ApiProperty({
    description:
      'Operator-provided publication reason/reference; also explicitly approves all-unlinked publication.',
  })
  @IsString()
  @Matches(/\S/)
  @MaxLength(1000)
  approvalRef!: string;

  @ApiPropertyOptional({
    description:
      'Required only to replace this exact currently published dataset.',
  })
  @IsOptional()
  @IsUUID()
  replaceDatasetId?: string;
}
export class ArchiveImportParamsDto {
  @IsUUID()
  id!: string;
}
export class ArchiveImportResponseDto {
  @ApiProperty() datasetKey!: string;
  @ApiProperty({ nullable: true }) currentPublishedDatasetId!: string | null;
  @ApiProperty() importId!: string;
  @ApiProperty() datasetVersion!: string;
  @ApiProperty({
    enum: [
      'VALIDATING',
      'STAGING',
      'READY',
      'PUBLISHING',
      'FAILED',
      'PUBLISHED',
      'SUPERSEDED',
    ],
  })
  status!: string;
  @ApiProperty({ nullable: true }) datasetId!: string | null;
  @ApiProperty() insurerRowCount!: number;
  @ApiProperty() reinsurerRowCount!: number;
  @ApiProperty() totalRowCount!: number;
  @ApiProperty() duplicateUpload!: boolean;
  @ApiProperty() publicationPermitted!: boolean;
  @ApiProperty({ type: [Number] }) reportingYears!: number[];
  @ApiProperty({ type: [Object] }) files!: object[];
  @ApiProperty({ type: [Object] }) warnings!: object[];
  @ApiProperty({ type: [String] }) errors!: string[];
}
