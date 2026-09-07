import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class AssignAssetDto {
  @ApiProperty({ description: 'Employee ID to assign the asset to' })
  @IsString()
  employeeId!: string;
}
