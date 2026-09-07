import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class UpdateAttendanceSettingsDto {
  @ApiProperty({
    description:
      'Grace period in minutes before a clock-in is marked late (0 = no grace period)',
    example: 15,
    minimum: 0,
  })
  @IsInt()
  @Min(0)
  lateArrivalThresholdMinutes!: number;
}
