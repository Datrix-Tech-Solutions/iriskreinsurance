import { throttlerBuckets } from './throttler.config';

function bucket(name: string) {
  const throttler = throttlerBuckets.find((entry) => entry.name === name);
  expect(throttler).toBeDefined();
  return throttler!;
}

describe('Gateway throttler configuration', () => {
  it('allows normal authenticated SPA request bursts without disabling throttling', () => {
    expect(bucket('short')).toMatchObject({ ttl: 1000, limit: 30 });
    expect(bucket('medium')).toMatchObject({ ttl: 10000, limit: 150 });
    expect(bucket('long')).toMatchObject({ ttl: 60000, limit: 600 });
  });

  it('keeps the current Reinsurance dashboard burst below the short bucket', () => {
    expect(bucket('short').limit).toBeGreaterThanOrEqual(26);
  });
});
