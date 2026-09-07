import { IsOptional, IsUUID } from 'class-validator';

export class QuerySchedulesDto {
  @IsOptional()
  @IsUUID()
  employeeId?: string;
}
