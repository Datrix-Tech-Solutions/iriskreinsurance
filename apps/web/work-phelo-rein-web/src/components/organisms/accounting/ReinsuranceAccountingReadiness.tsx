'use client';

import { Badge } from '@/components/atoms/Badge';
import { Button } from '@/components/atoms/Button';
import { cardClass } from '@/lib/utils';
import { useReinsuranceAccountingIntegrationStatus } from '@/hooks';
import type {
  ReinsuranceAccountingReadinessGroup,
  ReinsuranceAccountingReadinessGroupKey,
} from '@/types/accountingIntegration';

const GROUPS: Array<{ key: ReinsuranceAccountingReadinessGroupKey; label: string }> = [
  { key: 'premiumAccounting', label: 'Premium accounting' },
  { key: 'cashConfirmation', label: 'Cash confirmation' },
];

function groupBlockers(group: ReinsuranceAccountingReadinessGroup) {
  return group.events.flatMap((event) => event.blockers);
}

export function ReinsuranceAccountingReadiness() {
  const { data, isLoading, isError, refetch } = useReinsuranceAccountingIntegrationStatus();

  if (isLoading) {
    return (
      <div className={cardClass('h-28 animate-pulse')} aria-label="Loading Accounting readiness" />
    );
  }

  if (isError) {
    return (
      <section
        className={cardClass('flex flex-wrap items-center justify-between gap-3 p-4')}
        role="alert"
        aria-live="polite"
      >
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Reinsurance Accounting Readiness</h3>
          <p className="mt-1 text-sm text-gray-600">
            Unable to load Accounting readiness. Check your access and try again.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => void refetch()}>
          Try again
        </Button>
      </section>
    );
  }

  if (!data) {
    return null;
  }

  // A deliberately disconnected tenant has no Accounting readiness obligation.
  if (!data.integrationActive) {
    return null;
  }

  const configured = data.integrationConfigured;

  return (
    <section className={cardClass('p-4')} aria-labelledby="reinsurance-accounting-readiness-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3
            id="reinsurance-accounting-readiness-title"
            className="text-sm font-semibold text-gray-900"
          >
            Reinsurance Accounting Readiness
          </h3>
          <p className="mt-1 text-sm text-gray-600">{data.message}</p>
        </div>
        <Badge
          label={
            configured
              ? data.postingReadiness?.ready
                ? 'Ready'
                : 'Action required'
              : 'Not configured'
          }
          variant={configured && data.postingReadiness?.ready ? 'success' : 'warning'}
        />
      </div>

      {data.readinessGroups && (
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {GROUPS.map(({ key, label }) => {
            const group = data.readinessGroups?.[key];
            if (!group) return null;
            const blockers = groupBlockers(group);

            return (
              <div key={key} className="rounded-lg border border-gray-200 bg-white/50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-gray-800">{label}</span>
                  <Badge
                    label={group.ready ? 'Ready' : 'Blocked'}
                    variant={group.ready ? 'success' : 'warning'}
                  />
                </div>
                {!group.ready && blockers.length > 0 && (
                  <p className="mt-2 text-xs text-gray-600">{blockers[0].message}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
