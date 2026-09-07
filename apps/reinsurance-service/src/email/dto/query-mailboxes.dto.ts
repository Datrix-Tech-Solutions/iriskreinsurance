import { IsEnum, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  MailboxConnectionStatus,
  MailboxProvider,
} from '../../../prisma/generated/client';
import { QueryPaginationDto } from './query-pagination.dto';

export class QueryMailboxesDto extends QueryPaginationDto {
  @ApiPropertyOptional({ enum: MailboxProvider })
  @IsOptional()
  @IsEnum(MailboxProvider)
  provider?: MailboxProvider;

  @ApiPropertyOptional({ enum: MailboxConnectionStatus })
  @IsOptional()
  @IsEnum(MailboxConnectionStatus)
  status?: MailboxConnectionStatus;
}
