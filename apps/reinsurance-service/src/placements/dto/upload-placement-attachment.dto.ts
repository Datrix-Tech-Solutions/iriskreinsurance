import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UploadPlacementAttachmentDto {
  @ApiPropertyOptional({
    example: 'Signed policy schedule',
    description: 'Optional business title for the uploaded file.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  title?: string;

  @ApiPropertyOptional({
    example: 'Cedant-supplied supporting schedule.',
    description: 'Optional note describing why the file was attached.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
}
