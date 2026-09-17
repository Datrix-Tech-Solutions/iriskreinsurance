'use client';

import { fmtDate, fmtVal } from './formatters';
import { placementDetailEntries } from '@/lib/reinsurance/placementFormDetails';

const PARAM_FIELDS: { key: string; label: string }[] = [
  { key: 'policyNumber', label: 'Policy Number' },
  { key: 'reference', label: 'Reference' },
  { key: 'title', label: 'Insured' },
  { key: 'sumInsured', label: 'Sum Insured' },
  { key: 'rate', label: 'Rate (%)' },
  { key: 'premium', label: 'Premium' },
  { key: 'facultativeOffer', label: 'Fac. Offer (%)' },
  { key: 'commission', label: 'Commission (%)' },
  { key: 'currency', label: 'Currency' },
  { key: 'inceptionDate', label: 'Inception Date' },
  { key: 'expiryDate', label: 'Expiry Date' },
];

const DATE_KEYS = new Set(['inceptionDate', 'expiryDate']);

// Risk/offer detail fields (schema-driven risk details + custom "extra" fields) aren't flat
// scalars on the snapshot — they live nested under businessDetails/offerDetails, so they need
// their own extraction/diff pass alongside PARAM_FIELDS.
function detailEntryMap(
  record: Record<string, unknown>,
): Map<string, { label: string; value: unknown }> {
  const businessDetails = (record.businessDetails ?? null) as Record<string, unknown> | null;
  const offerDetails = (record.offerDetails ?? null) as Record<string, unknown> | null;
  const map = new Map<string, { label: string; value: unknown }>();
  for (const entry of [
    ...placementDetailEntries(businessDetails),
    ...placementDetailEntries(offerDetails),
  ]) {
    map.set(entry.key, { label: entry.label, value: entry.value });
  }
  return map;
}

export function ParameterChangesTable({
  original,
  proposed,
}: {
  original: Record<string, unknown>;
  proposed: Record<string, unknown>;
}) {
  const changedFields = PARAM_FIELDS.filter(({ key }) => {
    const b = proposed[key];
    return b !== undefined && String(original[key] ?? '') !== String(b ?? '');
  });

  const originalDetails = detailEntryMap(original);
  const proposedDetails = detailEntryMap(proposed);
  const changedDetailFields = Array.from(
    new Set([...originalDetails.keys(), ...proposedDetails.keys()]),
  )
    .map((key) => ({
      key,
      label: (proposedDetails.get(key) ?? originalDetails.get(key))!.label,
    }))
    .filter(
      ({ key }) =>
        String(originalDetails.get(key)?.value ?? '') !==
        String(proposedDetails.get(key)?.value ?? ''),
    );

  const allChanged = [...changedFields, ...changedDetailFields];

  if (allChanged.length === 0) {
    return <p className="text-xs text-gray-400 italic">No parameter changes recorded.</p>;
  }

  const originalValue = (key: string) =>
    originalDetails.has(key) ? originalDetails.get(key)!.value : original[key];
  const proposedValue = (key: string) =>
    proposedDetails.has(key) ? proposedDetails.get(key)!.value : proposed[key];

  return (
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr className="border-b border-gray-200">
          <th className="py-1.5 pr-3 text-left text-xs font-semibold text-gray-500">Field</th>
          <th className="py-1.5 px-3 text-left text-xs font-semibold text-gray-500">Original</th>
          <th className="py-1.5 pl-3 text-left text-xs font-semibold text-gray-500">Revised</th>
        </tr>
      </thead>
      <tbody>
        {allChanged.map(({ key, label }) => (
          <tr key={key} className="border-b border-gray-50 last:border-0">
            <td className="py-0.5 pr-3 text-gray-500">{label}</td>
            <td className="py-0.5 px-3 text-gray-700">
              {DATE_KEYS.has(key)
                ? fmtDate(originalValue(key) as string)
                : fmtVal(originalValue(key))}
            </td>
            <td className="py-0.5 pl-3 font-medium text-green-700">
              {DATE_KEYS.has(key)
                ? fmtDate(proposedValue(key) as string)
                : fmtVal(proposedValue(key))}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
