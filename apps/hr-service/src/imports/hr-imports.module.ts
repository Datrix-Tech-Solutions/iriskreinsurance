import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { HrImportsController } from './hr-imports.controller';
import { HrEmployeeImportsService } from './hr-employee-imports.service';

@Module({
  imports: [PrismaModule],
  controllers: [HrImportsController],
  providers: [HrEmployeeImportsService],
})
export class HrImportsModule {}
