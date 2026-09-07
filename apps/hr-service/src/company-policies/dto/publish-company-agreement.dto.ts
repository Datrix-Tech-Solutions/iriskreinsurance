import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class PublishCompanyAgreementDto {
  @ApiPropertyOptional({
    description:
      'Optional source document URL or storage path to snapshot with the published version.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  documentUrl?: string;
}
