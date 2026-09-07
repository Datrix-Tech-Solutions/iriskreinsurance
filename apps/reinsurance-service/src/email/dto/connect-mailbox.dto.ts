import { Type } from 'class-transformer';
import {
  IsDate,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MailboxProvider } from '../../../prisma/generated/client';
import { TrimmedString } from '../../counterparties/dto/string.transforms';

export class ConnectMailboxDto {
  @ApiProperty({
    enum: MailboxProvider,
    example: MailboxProvider.MICROSOFT_GRAPH,
    description:
      'Microsoft Graph is the supported MVP provider. Gmail is reserved for a future provider implementation.',
  })
  @IsEnum(MailboxProvider)
  provider!: MailboxProvider;

  @ApiProperty({ example: 'placements@broker.example' })
  @TrimmedString()
  @IsEmail()
  @MaxLength(320)
  emailAddress!: string;

  @ApiPropertyOptional({ example: 'Reinsurance Placements Mailbox' })
  @TrimmedString()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  displayName?: string;

  @ApiPropertyOptional({
    writeOnly: true,
    description:
      'Short-lived OAuth access token used for verification and initial sync proof-of-concept. Stored encrypted.',
  })
  @IsOptional()
  @IsString()
  accessToken?: string;

  @ApiPropertyOptional({
    writeOnly: true,
    description: 'OAuth refresh token. Stored encrypted when supplied.',
  })
  @IsOptional()
  @IsString()
  refreshToken?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  tokenExpiresAt?: Date;
}
