import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { TrimmedString } from '../../counterparties/dto/string.transforms';
import { QueryPaginationDto } from './query-pagination.dto';

export class QueryEmailThreadsDto extends QueryPaginationDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  mailboxConnectionId?: string;

  @ApiPropertyOptional({ example: 'renewal', maxLength: 100 })
  @TrimmedString()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
