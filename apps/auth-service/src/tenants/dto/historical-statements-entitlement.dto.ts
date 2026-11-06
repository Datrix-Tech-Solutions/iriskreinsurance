import { IsBoolean, IsString, Matches, MaxLength } from 'class-validator';

export class HistoricalStatementsEntitlementDto {
  @IsBoolean()
  enabled!: boolean;

  @IsString()
  @Matches(/\S/, { message: 'reason must contain non-whitespace text' })
  @MaxLength(1000)
  reason!: string;
}

// Access always uses the authenticated database identity; no selectors accepted.
export class HistoricalStatementsAccessQueryDto {}
