import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { HistoricalStatementKind } from './useHistoricalStatements';

const BASE = '/operations/reinsurance/historical-statements/imports';

export const HISTORICAL_IMPORT_YEARS = [2021, 2022, 2023, 2024, 2025] as const;
export const HISTORICAL_IMPORT_MAX_FILE_BYTES = 16 * 1024 * 1024;

export type HistoricalImportStatus =
  | 'VALIDATING'
  | 'STAGING'
  | 'READY'
  | 'PUBLISHING'
  | 'PUBLISHED'
  | 'SUPERSEDED'
  | 'FAILED';

export interface HistoricalImport {
  importId: string;
  datasetKey: string;
  datasetVersion: string;
  datasetId: string | null;
  currentPublishedDatasetId: string | null;
  status: HistoricalImportStatus;
  insurerRowCount: number;
  reinsurerRowCount: number;
  totalRowCount: number;
  duplicateUpload: boolean;
  publicationPermitted: boolean;
  reportingYears: number[];
  files: {
    fileName: string;
    kind: HistoricalStatementKind;
    year: number;
    sha256: string;
    rowCount: number | null;
  }[];
  warnings: { code: string; count: number }[];
  errors: string[];
}

export interface HistoricalAccess {
  enabled: boolean;
  canView: boolean;
  canExport: boolean;
  canImport: boolean;
}

/** Whether the session may upload (hides the Import button otherwise; backend stays authoritative). */
export function useHistoricalAccess() {
  return useQuery({
    queryKey: ['auth', 'historical-statements-access'],
    queryFn: async () =>
      (await api.get<HistoricalAccess>('/auth/tenants/me/historical-statements-access')).data,
    staleTime: 60_000,
    retry: false,
  });
}

export const slotKey = (year: number, kind: HistoricalStatementKind) => `${year}:${kind}`;

const TERMINAL: HistoricalImportStatus[] = ['READY', 'FAILED', 'PUBLISHED', 'SUPERSEDED'];

export function useUploadHistoricalImport() {
  return useMutation({
    mutationFn: async (slots: Record<string, File>) => {
      const data = new FormData();
      const metadata: { index: number; kind: HistoricalStatementKind; year: number }[] = [];
      for (const year of HISTORICAL_IMPORT_YEARS) {
        for (const kind of ['INSURER', 'REINSURER'] as const) {
          const file = slots[slotKey(year, kind)];
          if (!file) throw new Error('Select all ten workbooks before uploading.');
          metadata.push({ index: metadata.length, kind, year });
          data.append('files', file);
        }
      }
      data.append('metadata', JSON.stringify(metadata));
      const res = await api.post<HistoricalImport>(BASE, data, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 0,
      });
      return res.data;
    },
  });
}

/** Polls until the import reaches a terminal state. */
export function useHistoricalImportStatus(importId: string | null) {
  return useQuery({
    queryKey: ['reinsurance', 'historical-statements', 'import', importId],
    enabled: !!importId,
    queryFn: async () => (await api.get<HistoricalImport>(`${BASE}/${importId}`)).data,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && TERMINAL.includes(status) ? false : 3000;
    },
  });
}

export function usePublishHistoricalImport(importId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      datasetVersion: string;
      approvalRef: string;
      replaceDatasetId?: string;
    }) => {
      await api.post(`${BASE}/${importId}/publish`, body);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['reinsurance', 'historical-statements', 'import', importId] });
    },
  });
}

export function importErrorMessage(error: unknown): string {
  if (error instanceof Error && !('response' in error)) return error.message;
  const err = error as { response?: { status?: number; data?: { message?: string | string[] } } };
  const status = err.response?.status;
  const message = err.response?.data?.message;
  const text = Array.isArray(message) ? message.join(', ') : message;
  if (status === 403) return 'You are not allowed to import historical statements.';
  if (status === 413) return 'A file is too large (16 MiB per file).';
  if (status === 429) return 'The import queue is busy. Try again in a few minutes.';
  if (status === 503) return 'Import storage or database is not provisioned yet. Contact an administrator.';
  if (status === 409) return text ?? 'The import cannot be changed right now (busy, not ready or conflict).';
  return text ?? 'Import request failed.';
}
