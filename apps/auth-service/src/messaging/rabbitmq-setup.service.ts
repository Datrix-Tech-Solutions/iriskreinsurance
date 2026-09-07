import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

@Injectable()
export class RabbitMQSetupService implements OnModuleInit {
  private readonly logger = new Logger(RabbitMQSetupService.name);

  onModuleInit() {
    // DLX setup disabled — not supported on CloudAMQP free tier
    this.logger.log('RabbitMQ setup skipped (DLX disabled)');
  }
}
