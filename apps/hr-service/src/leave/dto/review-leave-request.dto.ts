import { IsEnum, IsOptional, IsString } from 'class-validator';

export class ReviewLeaveRequestDto {
  @IsEnum(['APPROVED', 'REJECTED']) action!: 'APPROVED' | 'REJECTED';
  @IsOptional() @IsString() note?: string;
}
