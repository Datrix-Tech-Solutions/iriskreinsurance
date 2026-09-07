import { PartialType } from '@nestjs/swagger';
import { CreateBranchDto } from './create-branch.dto';
import { IsBoolean, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateBranchDto extends PartialType(CreateBranchDto) {
  @ApiPropertyOptional({ description: 'Whether the branch is active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
