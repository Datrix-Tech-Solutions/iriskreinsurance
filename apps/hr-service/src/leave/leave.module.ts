import { Module, forwardRef } from '@nestjs/common';
import { LeaveService } from './leave.service';
import { LeaveController } from './leave.controller';
import { RabbitMQModule } from '../messaging/rabbitmq.module';

@Module({
  imports: [forwardRef(() => RabbitMQModule)],
  controllers: [LeaveController],
  providers: [LeaveService],
  exports: [LeaveService],
})
export class LeaveModule {}
