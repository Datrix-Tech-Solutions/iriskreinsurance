import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';

export class UpdateResignationSettingsDto {
  @ApiProperty({
    example: 30,
    description: 'Minimum notice period in days before the last working date',
  })
  @IsInt()
  @Min(0)
  @Max(365)
  resignationNoticePeriodDays!: number;
}
