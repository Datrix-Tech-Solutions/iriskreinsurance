import { IsEnum, IsOptional } from 'class-validator';

export enum LeaveRequestStatusQuery {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

export class QueryLeaveRequestsDto {
  @IsOptional()
  @IsEnum(LeaveRequestStatusQuery)
  status?: LeaveRequestStatusQuery;
}
