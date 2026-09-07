import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class QueryEligibleSwapColleaguesDto {
  @IsUUID()
  scheduleId!: string;

  @IsDateString()
  shiftDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
