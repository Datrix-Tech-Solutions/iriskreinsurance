import {
  csvToExcelHtml,
  formatExportDate,
  formatExportPeriod,
} from './report-excel-export';

describe('csvToExcelHtml', () => {
  it('converts exported CSV rows to an Excel-compatible HTML table', () => {
    const workbook = csvToExcelHtml(
      'Policy Number,Cedant,Amount\n"POL,001","A & B ""Insurance""",100\n',
      'Premiums Report',
    );

    expect(workbook).toContain('urn:schemas-microsoft-com:office:excel');
    expect(workbook).toContain('<title>Premiums Report</title>');
    expect(workbook).toContain('<td>Policy Number</td>');
    expect(workbook).toContain('<td>POL,001</td>');
    expect(workbook).toContain('<td>A &amp; B &quot;Insurance&quot;</td>');
    expect(workbook).toContain('<td>100</td>');
  });

  it('formats export dates as date-only strings', () => {
    expect(formatExportDate('2026-08-27T16:56:40.000Z')).toBe('2026-08-27');
    expect(formatExportDate(new Date('2026-09-08T08:50:34.000Z'))).toBe(
      '2026-09-08',
    );
    expect(
      formatExportPeriod(
        '2026-01-01T00:00:00.000Z',
        '2026-12-31T23:59:59.999Z',
      ),
    ).toBe('2026-01-01 - 2026-12-31');
  });
});
