import { ThrottlerModuleOptions } from '@nestjs/throttler';

export const throttlerBuckets = [
  {
    name: 'short',
    ttl: 1000,
    limit: 30,
  },
  {
    name: 'medium',
    ttl: 10000,
    limit: 150,
  },
  {
    name: 'long',
    ttl: 60000,
    limit: 600,
  },
];

export const throttlerConfig: ThrottlerModuleOptions = {
  throttlers: throttlerBuckets,
};
