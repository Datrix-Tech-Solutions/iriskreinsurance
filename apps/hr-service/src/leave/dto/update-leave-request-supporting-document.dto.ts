import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class UpdateLeaveRequestSupportingDocumentDto {
  @ApiProperty({
    description: 'Supporting document display name',
    example: 'Medical Report - May 2026',
  })
  @IsString()
  supportingDocumentName!: string;

  @ApiProperty({
    description: 'Supporting document URL or storage path',
    example: 'https://storage.example.com/leave-docs/medical-report-123.pdf',
  })
  @IsString()
  supportingDocumentUrl!: string;
}
