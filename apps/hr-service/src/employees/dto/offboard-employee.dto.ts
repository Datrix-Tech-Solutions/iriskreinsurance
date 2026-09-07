import {
  IsString,
  IsDateString,
  IsEnum,
  IsOptional,
  IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum OffboardReason {
  RESIGNATION = 'RESIGNATION',
  TERMINATION = 'TERMINATION',
  CONTRACT_ENDED = 'CONTRACT_ENDED',
  RETIREMENT = 'RETIREMENT',
  REDUNDANCY = 'REDUNDANCY',
  OTHER = 'OTHER',
}

export class InitiateOffboardDto {
  @ApiProperty({ enum: OffboardReason })
  @IsEnum(OffboardReason)
  reason!: OffboardReason;

  @ApiPropertyOptional({ description: 'Required when reason is OTHER' })
  @IsOptional()
  @IsString()
  otherReason?: string;

  @ApiProperty({ example: '2026-05-31', description: 'Last working date' })
  @IsDateString()
  lastWorkingDate!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  exitNotes?: string;
}

export class UpdateChecklistDto {
  @ApiProperty({
    enum: [
      'assetReturn',
      'hrClearance',
      'financeClearance',
      'reportingClearance',
    ],
  })
  @IsString()
  item!:
    | 'assetReturn'
    | 'hrClearance'
    | 'financeClearance'
    | 'reportingClearance';

  @ApiProperty()
  @IsBoolean()
  done!: boolean;
}
