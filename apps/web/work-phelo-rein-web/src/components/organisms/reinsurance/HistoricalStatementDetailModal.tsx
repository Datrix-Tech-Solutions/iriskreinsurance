'use client';

import { Modal } from '@/components/organisms/shared/Modal';
import { Badge } from '@/components/atoms/Badge';
import {
  HistoricalStatementRow,
  historicalErrorMessage,
  useHistoricalLinks,
  useHistoricalStatementDetail,
} from '@/hooks/reinsurance/useHistoricalStatements';
import { fmtDecimal, fmtSourceDate } from '@/lib/reinsurance/historicalFormat';

interface HistoricalStatementDetailModalProps {
  row: HistoricalStatementRow | null;
  datasetId: string;
  onClose: () => void;
}

const nameOf = (r: HistoricalStatementRow) =>
  r.kind === 'INSURER' ? r.insurerName : r.reinsurerName;

/** Source values are rendered strictly as text — formulas are provenance, never executed. */
export function HistoricalStatementDetailModal({
  row,
  datasetId,
  onClose,
}: HistoricalStatementDetailModalProps) {
  const kind = row?.kind ?? 'INSURER';
  const id = row?.id ?? null;
  const detail = useHistoricalStatementDetail(kind, id, datasetId);
  const links = useHistoricalLinks(kind, id, datasetId);

  const error = historicalErrorMessage(detail.error);
  const data = detail.data;
  const linkedLabel = kind === 'INSURER' ? 'Linked reinsurer rows' : 'Linked insurer row';

  return (
    <Modal
      isOpen={row !== null}
      onClose={onClose}
      title={row ? `${row.policyNumber ?? 'Statement'} · ${row.year}` : 'Statement'}
      description={row ? `${nameOf(row) ?? '—'} · ${row.sourceFileName} row ${row.sourceRow}` : undefined}
      width="max-w-5xl"
      height="max-h-[85vh]"
    >
      <div className="flex flex-col gap-5 overflow-y-auto">
        {error && <p className="text-sm text-red-600">{error}</p>}
        {detail.isLoading && <p className="text-sm text-gray-500">Loading…</p>}

        {data && data.qualityWarnings.length > 0 && (
          <section className="flex flex-col gap-2">
            <h4 className="text-sm font-semibold text-gray-900">Source quality warnings</h4>
            <div className="flex flex-wrap gap-2">
              {data.qualityWarnings.map((w, i) => (
                <span key={`${w.code}-${i}`} title={w.sourceValue}>
                  <Badge
                    label={`${w.code}${w.columnIndex ? ` (col ${w.columnIndex})` : ''}${
                      w.sourceValue ? `: ${w.sourceValue}` : ''
                    }`}
                    variant="warning"
                  />
                </span>
              ))}
            </div>
          </section>
        )}

        <section className="flex flex-col gap-2">
          <h4 className="text-sm font-semibold text-gray-900">{linkedLabel}</h4>
          {links.isLoading ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : links.error ? (
            <p className="text-sm text-red-600">{historicalErrorMessage(links.error)}</p>
          ) : !links.data || links.data.items.length === 0 ? (
            <p className="text-sm text-gray-500">
              Unlinked — no approved link exists for this row.
            </p>
          ) : (
            <ul className="flex flex-col gap-1 text-sm text-gray-700">
              {links.data.items.map(({ link, statement }) => (
                <li key={statement.id} className="flex flex-wrap items-center gap-x-3">
                  <span className="font-medium text-gray-900">{nameOf(statement) ?? '—'}</span>
                  <span>{statement.policyNumber ?? '—'}</span>
                  <span>{statement.currency ?? ''}</span>
                  <span>{statement.facPremium ? fmtDecimal(statement.facPremium) : '—'}</span>
                  <span>{fmtSourceDate(statement.closedDate)}</span>
                  <Badge label={link.basis === 'APPROVED_CANDIDATE' ? 'Approved' : 'Supplied'} />
                </li>
              ))}
            </ul>
          )}
        </section>

        {data && (
          <section className="flex flex-col gap-2">
            <h4 className="text-sm font-semibold text-gray-900">
              Original columns ({data.originalColumns.length})
            </h4>
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 text-gray-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">Col</th>
                    <th className="px-3 py-2 font-medium">Header</th>
                    <th className="px-3 py-2 font-medium">Value</th>
                    <th className="px-3 py-2 font-medium">Formula</th>
                    <th className="px-3 py-2 font-medium">State</th>
                  </tr>
                </thead>
                <tbody>
                  {data.originalColumns.map((col) => (
                    <tr key={col.columnIndex} className="border-t border-gray-100">
                      <td className="px-3 py-1.5 text-gray-500">{col.columnLetter}</td>
                      <td className="px-3 py-1.5 text-gray-700">{col.header ?? '—'}</td>
                      <td className="px-3 py-1.5 font-mono text-gray-900 break-all">
                        {col.value ?? '—'}
                      </td>
                      <td className="px-3 py-1.5 font-mono text-gray-500 break-all">
                        {col.formula ?? ''}
                      </td>
                      <td className="px-3 py-1.5 text-gray-500">{col.state}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </Modal>
  );
}
