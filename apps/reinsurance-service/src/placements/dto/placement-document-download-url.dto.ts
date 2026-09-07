import { ApiProperty } from '@nestjs/swagger';

export class PlacementDocumentDownloadUrlDto {
  @ApiProperty({
    example:
      'https://workphelo-reinsurance-documents.s3.eu-west-1.amazonaws.com/reinsurance/...',
  })
  url!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  expiresAt!: string;

  @ApiProperty({ example: 'application/pdf' })
  mimeType!: string;

  @ApiProperty({ example: 'DOC-CS-001.pdf' })
  fileName!: string;
}
