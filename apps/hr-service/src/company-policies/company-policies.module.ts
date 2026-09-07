import { Module } from '@nestjs/common';
import { CompanyAgreementsController } from './company-agreements.controller';
import { CompanyAgreementsService } from './company-agreements.service';

@Module({
  controllers: [CompanyAgreementsController],
  providers: [CompanyAgreementsService],
  exports: [CompanyAgreementsService],
})
export class CompanyPoliciesModule {}
