import { ApiProperty } from '@nestjs/swagger';
import { Equals, IsString, MaxLength, MinLength } from 'class-validator';

export class SignCompanyAgreementDto {
  @ApiProperty({
    example: 'Ama Mensah',
    description: 'Employee typed legal name used as the MVP signature.',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  typedName!: string;

  @ApiProperty({
    example: true,
    description:
      'Must be true. Confirms the employee has read and agrees to the agreement.',
  })
  @Equals(true)
  consentAccepted!: true;
}
