import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class DeclineCompanyAgreementDto {
  @ApiProperty({
    example: 'I need HR to clarify clause 4 before I can sign.',
    description: 'Employee reason for declining the agreement.',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  reason!: string;
}
