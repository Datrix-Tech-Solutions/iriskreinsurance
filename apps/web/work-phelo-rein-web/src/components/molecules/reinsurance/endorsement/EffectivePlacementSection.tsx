'use client';

import { Badge } from '@/components/atoms/Badge';
import { EffectivePlacementView, ENDORSEMENT_STATUS_LABELS } from '@/types/reinsurance';
import { fmtMoney } from './formatters';
import { cardClass } from '@/lib/utils';

function fmtDate(iso: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function EffectivePlacementSection({
  view,
  isLoading,
  isError,
}: {
  view: EffectivePlacementView | undefined;
  isLoading: boolean;
  isError: boolean;
}) {
  if (isLoading) {
    return <p className="text-sm text-gray-400">Loading latest confirmed offer details...</p>;
  }
  if (isError || !view) {
    return (
      <p className="text-sm text-red-500">Latest confirmed offer details could not be loaded.</p>
    );
  }

  const terms = view.effectiveTerms;
  const totals = view.effectiveTotals;
  const capacity = view.capacityBreakdown;
  const currency = terms.currency ?? totals.currency;
  return (
    <details className={cardClass('p-4')}>
      <summary className="cursor-pointer list-none">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h4 className="text-sm font-semibold text-gray-900">
              Current Offer as of{' '}
              <span className="text-xs text-gray-500 mt-1">{fmtDate(view.viewAsOf)}</span>
            </h4>
          </div>
          <div className="grid grid-cols-2 gap-3 text-right lg:grid-cols-3">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-gray-400">Capacity</p>
              <p className="text-sm font-semibold text-gray-900">
                {capacity.effectiveTotalCapacityPercent}%
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-gray-400">Sum Insured</p>
              <p className="text-sm font-semibold text-gray-900">
                {fmtMoney(terms.sumInsured, currency)}
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-gray-400">Premium</p>
              <p className="text-sm font-semibold text-gray-900">
                {fmtMoney(terms.premium, currency)}
              </p>
            </div>
          </div>
        </div>
      </summary>

      <div className="mt-4 flex flex-col gap-4 border-t border-gray-100 pt-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="text-xs text-gray-500 mt-1">
              The original placement remains unchanged. Expand this panel only when you need the
              latest effective totals and reinsurer lines.
            </p>
          </div>
          <Badge label="Read only" variant="neutral" />
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            ['Original Capacity', `${capacity.originalCapacityPercent ?? '—'}%`],
            ['Effective Capacity', `${capacity.effectiveTotalCapacityPercent}%`],
            ['Confirmed Endorsement Capacity', `${capacity.confirmedEndorsementCapacityPercent}%`],
            ['Remaining Capacity', `${capacity.remainingCapacityPercent}%`],
            ['Sum Insured', fmtMoney(terms.sumInsured, currency)],
            ['Effective Premium', fmtMoney(terms.premium, currency)],
            ['Closing Gross Premium', fmtMoney(totals.grossPremium, currency)],
            ['Closing Net Premium', fmtMoney(totals.netPremium, currency)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
              <p className="text-xs text-gray-500">{label}</p>
              <p className="text-sm font-semibold text-gray-900 mt-1">{value}</p>
            </div>
          ))}
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
            Effective Reinsurer Lines ({totals.participantCount})
          </p>
          {view.effectiveParticipants.length === 0 ? (
            <p className="text-xs text-gray-400">No confirmed participant lines yet.</p>
          ) : (
            <div className="flex flex-col divide-y divide-gray-100">
              {view.effectiveParticipants.map((participant) => (
                <div
                  key={participant.counterpartyId}
                  className="py-2 flex items-center justify-between gap-3"
                >
                  <div>
                    <span className="text-sm text-gray-700">{participant.counterparty.name}</span>
                    <p className="text-[11px] text-gray-400">{participant.participationType}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">
                      {participant.signedLinePercent}%
                    </p>
                    <p className="text-xs text-gray-500">
                      Net {fmtMoney(participant.netPremium, currency)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {view.pendingEndorsements.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs font-semibold text-amber-800">Pending endorsements</p>
            <p className="text-xs text-amber-700 mt-1">
              {view.pendingEndorsements
                .map(
                  (item) => `${item.endorsementNumber} (${ENDORSEMENT_STATUS_LABELS[item.status]})`,
                )
                .join(', ')}
            </p>
            {capacity.acceptedEndorsementCapacityPercent > 0 && (
              <p className="text-xs text-amber-700 mt-1">
                Accepted but not yet effective capacity:{' '}
                {capacity.acceptedEndorsementCapacityPercent}%
              </p>
            )}
          </div>
        )}

        {view.scheduledEndorsements.length > 0 && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
            <p className="text-xs font-semibold text-blue-800">Scheduled future endorsements</p>
            <p className="text-xs text-blue-700 mt-1">
              {view.scheduledEndorsements
                .map(
                  (item) =>
                    `${item.endorsementNumber} (${fmtDate(item.effectiveDate)}, ${
                      ENDORSEMENT_STATUS_LABELS[item.status]
                    })`,
                )
                .join(', ')}
            </p>
          </div>
        )}

        {view.warnings.length > 0 && (
          <div className="flex flex-col gap-1">
            {view.warnings.map((warning) => (
              <p key={warning} className="text-xs text-amber-700">
                {warning}
              </p>
            ))}
          </div>
        )}
      </div>
    </details>
  );
}
