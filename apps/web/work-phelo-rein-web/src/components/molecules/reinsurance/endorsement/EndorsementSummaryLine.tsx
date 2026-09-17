'use client';

import { fmtMoney } from './formatters';

interface EndorsementSummaryLineProps {
  participantCount: number;
  sumInsured: unknown;
  premium: unknown;
  offerPercent: number | null;
  currency: unknown;
}

/** Second collapsed-state line — a quick-glance summary shown alongside the header. */
export function EndorsementSummaryLine({
  participantCount,
  sumInsured,
  premium,
  offerPercent,
  currency,
}: EndorsementSummaryLineProps) {
  const currencyStr = typeof currency === 'string' ? currency : null;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
      <span>
        {participantCount} {participantCount === 1 ? 'Participant' : 'Participants'}
      </span>
      <span>
        Sum Insured{' '}
        <span className="font-medium text-gray-700">{fmtMoney(sumInsured, currencyStr)}</span>
      </span>
      <span>
        Premium <span className="font-medium text-gray-700">{fmtMoney(premium, currencyStr)}</span>
      </span>
      <span>
        Offer <span className="font-medium text-gray-700">{offerPercent ?? '—'}%</span>
      </span>
    </div>
  );
}
