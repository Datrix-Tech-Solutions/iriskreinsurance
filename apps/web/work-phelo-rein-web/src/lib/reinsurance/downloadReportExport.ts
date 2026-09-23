export type ReportExportFormat = 'csv' | 'xls';

export function datedReportFilename(reportName: string, format: ReportExportFormat): string {
  return `${reportName}-${new Date().toISOString().slice(0, 10)}.${format}`;
}

export function downloadReportBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function downloadReportText(text: string, filename: string, type: string): void {
  downloadReportBlob(new Blob([text], { type }), filename);
}
