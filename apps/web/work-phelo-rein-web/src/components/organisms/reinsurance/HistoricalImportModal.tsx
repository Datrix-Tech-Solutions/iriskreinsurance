'use client';

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { Badge } from '@/components/atoms/Badge';
import { Input } from '@/components/atoms/Input';
import {
  HISTORICAL_IMPORT_MAX_FILE_BYTES,
  HISTORICAL_IMPORT_YEARS,
  HistoricalImport,
  importErrorMessage,
  slotKey,
  usePublishHistoricalImport,
  useHistoricalImportStatus,
  useUploadHistoricalImport,
} from '@/hooks/reinsurance/useHistoricalImport';
import type { HistoricalStatementKind } from '@/hooks/reinsurance/useHistoricalStatements';
import { fmtCount } from '@/lib/reinsurance/historicalFormat';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Called with the canonical dataset id once an import is published. */
  onPublished?: (datasetId: string) => void;
}

const KINDS: HistoricalStatementKind[] = ['INSURER', 'REINSURER'];
const KIND_LABEL: Record<HistoricalStatementKind, string> = {
  INSURER: 'Insurer',
  REINSURER: 'Reinsurer',
};

const STATUS_LABEL: Record<string, string> = {
  VALIDATING: 'Validating workbooks…',
  STAGING: 'Staging rows…',
  READY: 'Ready to publish',
  PUBLISHING: 'Publishing…',
  PUBLISHED: 'Published',
  SUPERSEDED: 'Superseded',
  FAILED: 'Failed',
};

function fileProblem(file: File): string | null {
  if (!file.name.toLowerCase().endsWith('.xlsx')) return 'Only .xlsx files are accepted';
  if (file.size > HISTORICAL_IMPORT_MAX_FILE_BYTES) return 'Larger than 16 MiB';
  return null;
}

export function HistoricalImportModal({ isOpen, onClose, onPublished }: Props) {
  const qc = useQueryClient();
  const [slots, setSlots] = useState<Record<string, File>>({});
  const [importId, setImportId] = useState<string | null>(null);
  const [approvalRef, setApprovalRef] = useState('');
  const [confirmReplace, setConfirmReplace] = useState(false);
  const notifiedId = useRef<string | null>(null);
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  const upload = useUploadHistoricalImport();
  const status = useHistoricalImportStatus(importId);
  const publish = usePublishHistoricalImport(importId);

  const job: HistoricalImport | undefined = status.data;
  const problems = Object.values(slots).some((f) => fileProblem(f));
  const complete =
    HISTORICAL_IMPORT_YEARS.every((y) => KINDS.every((k) => slots[slotKey(y, k)])) && !problems;
  const busy = job && ['VALIDATING', 'STAGING', 'PUBLISHING'].includes(job.status);

  const needsReplace =
    !!job?.currentPublishedDatasetId && job.currentPublishedDatasetId !== job.datasetId;

  const publishedImportId = job?.status === 'PUBLISHED' ? job.importId : null;
  const publishedDatasetId = job?.datasetId ?? null;
  useEffect(() => {
    if (!publishedImportId || !publishedDatasetId || notifiedId.current === publishedImportId) return;
    notifiedId.current = publishedImportId;
    void qc.invalidateQueries({ queryKey: ['reinsurance', 'historical-statements'] });
    onPublished?.(publishedDatasetId);
  }, [publishedImportId, publishedDatasetId, qc, onPublished]);

  const reset = () => {
    setSlots({});
    setImportId(null);
    setApprovalRef('');
    setConfirmReplace(false);
    upload.reset();
    publish.reset();
  };

  const close = () => {
    if (job?.status === 'PUBLISHED' || job?.status === 'FAILED') reset();
    onClose();
  };

  const handleUpload = async () => {
    const res = await upload.mutateAsync(slots).catch(() => null);
    if (res) setImportId(res.importId);
  };

  const handlePublish = () => {
    if (!job) return;
    publish.mutate({
      datasetVersion: job.datasetVersion,
      approvalRef: approvalRef.trim(),
      ...(needsReplace && confirmReplace && job.currentPublishedDatasetId
        ? { replaceDatasetId: job.currentPublishedDatasetId }
        : {}),
    });
  };

  const canPublish =
    job?.status === 'READY' &&
    job.publicationPermitted &&
    approvalRef.trim().length > 0 &&
    (!needsReplace || confirmReplace);

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      title="Import historical statements"
      description="Upload the ten workbooks (insurer and reinsurer, 2021–2025), review the result, then publish."
      width="max-w-3xl"
      height="max-h-[88vh]"
    >
      <div className="flex flex-col gap-4 overflow-y-auto">
        {!importId && (
          <>
            <div className="overflow-hidden rounded-lg border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs text-gray-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">Year</th>
                    {KINDS.map((k) => (
                      <th key={k} className="px-3 py-2 font-medium">
                        {KIND_LABEL[k]} workbook
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {HISTORICAL_IMPORT_YEARS.map((year) => (
                    <tr key={year} className="border-t border-gray-100">
                      <td className="px-3 py-2 font-medium text-gray-800">{year}</td>
                      {KINDS.map((kind) => {
                        const key = slotKey(year, kind);
                        const file = slots[key];
                        const problem = file ? fileProblem(file) : null;
                        return (
                          <td key={kind} className="px-3 py-2">
                            <input
                              ref={(el) => {
                                inputs.current[key] = el;
                              }}
                              type="file"
                              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) setSlots((s) => ({ ...s, [key]: f }));
                                e.target.value = '';
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => inputs.current[key]?.click()}
                              className="max-w-[16rem] truncate rounded border border-dashed border-gray-300 px-2 py-1 text-left text-xs text-gray-600 hover:bg-gray-50"
                              title={file?.name}
                            >
                              {file ? file.name : 'Choose file…'}
                            </button>
                            {problem && <p className="mt-0.5 text-xs text-red-600">{problem}</p>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {upload.error && (
              <p className="text-sm text-red-600">{importErrorMessage(upload.error)}</p>
            )}
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">
                {Object.keys(slots).length} of 10 files selected
              </span>
              <Button
                disabled={!complete}
                isLoading={upload.isPending}
                loadingText="Uploading…"
                onClick={handleUpload}
              >
                Upload & validate
              </Button>
            </div>
          </>
        )}

        {importId && (
          <>
            {status.error && (
              <p className="text-sm text-red-600">{importErrorMessage(status.error)}</p>
            )}
            {!job && !status.error && <p className="text-sm text-gray-500">Loading…</p>}
            {job && (
              <>
                <div className="flex items-center gap-2">
                  <Badge
                    label={STATUS_LABEL[job.status] ?? job.status}
                    variant={
                      job.status === 'FAILED'
                        ? 'danger'
                        : job.status === 'PUBLISHED' || job.status === 'READY'
                          ? 'success'
                          : 'warning'
                    }
                  />
                  {job.duplicateUpload && (
                    <span className="text-xs text-gray-500">
                      Identical content was already loaded; the existing version is reused.
                    </span>
                  )}
                  {busy && <span className="text-xs text-gray-500">Checking every few seconds…</span>}
                </div>

                <p className="text-xs text-gray-500">
                  Version <span className="font-mono">{job.datasetVersion}</span>
                </p>

                {job.errors.length > 0 && (
                  <ul className="list-disc rounded-lg bg-red-50 p-3 pl-6 text-sm text-red-700">
                    {job.errors.map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ul>
                )}

                {job.status !== 'VALIDATING' && job.totalRowCount > 0 && (
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <Stat label="Insurer rows" value={fmtCount(job.insurerRowCount)} />
                    <Stat label="Reinsurer rows" value={fmtCount(job.reinsurerRowCount)} />
                    <Stat label="Total rows" value={fmtCount(job.totalRowCount)} />
                  </div>
                )}

                {job.files.length > 0 && (
                  <div className="overflow-hidden rounded-lg border border-gray-200">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 text-left text-gray-500">
                        <tr>
                          <th className="px-3 py-1.5 font-medium">File</th>
                          <th className="px-3 py-1.5 font-medium">Year</th>
                          <th className="px-3 py-1.5 font-medium">Kind</th>
                          <th className="px-3 py-1.5 text-right font-medium">Rows</th>
                        </tr>
                      </thead>
                      <tbody>
                        {job.files.map((f) => (
                          <tr key={f.sha256} className="border-t border-gray-100">
                            <td className="px-3 py-1.5">{f.fileName}</td>
                            <td className="px-3 py-1.5">{f.year}</td>
                            <td className="px-3 py-1.5">{KIND_LABEL[f.kind]}</td>
                            <td className="px-3 py-1.5 text-right">
                              {f.rowCount == null ? '—' : fmtCount(f.rowCount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {job.warnings.length > 0 && (
                  <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
                    <p className="mb-1 font-medium">
                      Historical data anomalies (kept as-is, not fatal)
                    </p>
                    <ul className="grid grid-cols-2 gap-x-4">
                      {job.warnings.map((w) => (
                        <li key={w.code}>
                          {w.code}: {fmtCount(w.count)}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {job.status === 'READY' && (
                  <div className="flex flex-col gap-3 border-t border-gray-100 pt-3">
                    <p className="text-xs text-gray-500">
                      Publishing makes this dataset visible to everyone with access. Rows are
                      published unlinked; no insurer–reinsurer links are guessed.
                    </p>
                    <Input
                      label="Approval reference"
                      placeholder="Reason or change reference for this publication"
                      value={approvalRef}
                      onChange={(e) => setApprovalRef(e.target.value)}
                    />
                    {needsReplace && (
                      <label className="flex items-start gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked={confirmReplace}
                          onChange={(e) => setConfirmReplace(e.target.checked)}
                        />
                        <span>
                          Another dataset is currently published. I confirm this import should
                          replace it.
                        </span>
                      </label>
                    )}
                    {publish.error && (
                      <p className="text-sm text-red-600">{importErrorMessage(publish.error)}</p>
                    )}
                    <div className="flex justify-end">
                      <Button
                        disabled={!canPublish}
                        isLoading={publish.isPending}
                        loadingText="Publishing…"
                        onClick={handlePublish}
                      >
                        Publish dataset
                      </Button>
                    </div>
                  </div>
                )}

                {job.status === 'PUBLISHED' && (
                  <div className="flex items-center justify-between border-t border-gray-100 pt-3">
                    <span className="text-sm text-green-700">
                      Published. The Legacy Data table now shows this dataset.
                    </span>
                    <Button onClick={close}>Done</Button>
                  </div>
                )}

                {job.status === 'FAILED' && (
                  <div className="flex justify-end border-t border-gray-100 pt-3">
                    <Button variant="outline" onClick={reset}>
                      Start over
                    </Button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-lg font-semibold text-gray-900">{value}</p>
    </div>
  );
}
