import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { useQuery } from '@tanstack/react-query';
import { PremiumsReportTable } from '@/components/organisms/reinsurance/tables/PremiumsReportTable';
import { PremiumsKpiCards } from '@/components/molecules/reinsurance/reports/PremiumsKpiCards';
import { PremiumsCurrencySummaryCards } from '@/components/molecules/reinsurance/reports/PremiumsCurrencySummaryCards';
import { ReportRowsSummary } from '@/components/molecules/reinsurance/reports/ReportRowsSummary';
import type { PremiumReportRow, PremiumsReportSummary } from './usePremiumsReport';

let mockAppliedScope: 'cedant' | 'reinsurer' = 'reinsurer';
const mockColumnLabels = jest.fn<void, [string[]]>();
jest.mock('./useAppliedReportParams', () => ({
  useAppliedReportParams: () => [{ scope: mockAppliedScope, page: 1, limit: 50 }, jest.fn()],
}));
jest.mock('@tanstack/react-query', () => ({
  ...jest.requireActual('@tanstack/react-query'),
  useQuery: jest.fn(),
}));
jest.mock('@/lib/api', () => ({ api: { get: jest.fn() } }));
jest.mock('next/navigation', () => ({ useParams: () => ({ tenantSlug: 'synthetic' }) }));
jest.mock('@/hooks/useLoadingRouter', () => ({ useLoadingRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/hooks', () => ({
  ...jest.requireActual('./usePremiumsReport'),
  ...jest.requireActual('../useDropdownPosition'),
  useCedantOptions: () => ({ options: [] }),
  useReinsurerOptions: () => ({ options: [] }),
  useCurrencyOptions: () => ({ data: [] }),
  useCurrencies: () => ({ data: [] }),
  useRiskTypeOptions: () => ({ data: [] }),
  usePlacementEndorsements: () => ({ data: [] }),
}));
jest.mock('@/components/organisms/shared/DataTable', () => {
  const actual = jest.requireActual<typeof import('@/components/organisms/shared/DataTable')>(
    '@/components/organisms/shared/DataTable',
  );
  return {
    ...actual,
    DataTable: (props: Parameters<typeof actual.DataTable>[0]) => {
      mockColumnLabels(props.columns.map((column) => column.label));
      return React.createElement(actual.DataTable, props);
    },
  };
});

const summary: PremiumsReportSummary = {
  placementCount: 1,
  participantCount: 1,
  cedantCount: 1,
  reinsurerCount: 1,
  closedCount: 1,
  openCount: 0,
  paymentStatusCounts: [],
  settlementCounts: { paid: 0, part: 1, outstanding: 0, pending: 7 },
  totalCollected: 300,
  outstanding: 500,
  currencySymbol: 'GHS',
  totalsByCurrency: [
    {
      currency: 'GHS',
      placementCount: 1,
      participantCount: 1,
      sumInsured: 50000,
      grossPremium: 1000,
      commission: 100,
      brokerage: 100,
      cedantCurrentObligation: 900,
      premiumReceived: 300,
      mandatoryDeductions: 100,
      effectiveSettlementCredit: 400,
      cedantOutstanding: 500,
      cedantPending: 0,
      reinsurerPayable: 800,
      reinsurerDisbursed: 300,
      reinsurerOutstanding: 500,
    },
  ],
};
const row: PremiumReportRow = {
  id: 'p1',
  placementId: 'p1',
  reference: 'FAC-SYNTHETIC',
  policyNumber: 'POL-SYNTHETIC',
  title: 'Synthetic insured',
  cedantId: 'c1',
  cedantName: 'Synthetic cedant',
  riskClassId: null,
  riskClassName: null,
  riskTypeId: null,
  policyType: null,
  status: 'CLOSED',
  offerDate: null,
  closedAt: null,
  inceptionDate: null,
  expiryDate: null,
  currency: 'GHS',
  sumInsured: 100000,
  premium: 2000,
  facultativeOfferPercent: 50,
  due: 900,
  paid: 300,
  mandatoryDeductions: 100,
  effectiveSettlementCredit: 400,
  outstanding: 500,
  pending: 0,
  paymentStatus: 'Part Payment',
  reinsurers: [
    {
      reinsurerId: 'r1',
      reinsurerName: 'Synthetic reinsurer',
      closingId: 'closing1',
      sharePercent: 50,
      grossPremium: 1000,
      commissionPercent: 10,
      commissionAmount: 100,
      brokerageAmount: 100,
      netPremium: 800,
      paidAmount: 300,
      outstandingAmount: 500,
      closedAt: null,
      settlementStatus: 'part',
      pendingAmount: 0,
    },
  ],
};
const common = [
  'Insured',
  'Policy Type',
  'Cedants',
  'Offer Date',
  'Date Closed',
  'Period of Insurance',
  'Currency',
  '100% S.I',
  '100% Premium',
  'Fac Share',
];
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useQuery).mockReturnValue({
    data: { items: [row], summary, meta: { page: 1, limit: 50, total: 1, totalPages: 1 } },
    isLoading: false,
    isFetching: true,
    isError: false,
    error: null,
    refetch: jest.fn(),
  } as unknown as ReturnType<typeof useQuery>);
});

it.each(['cedant', 'reinsurer'] as const)(
  'preserves dev column headings and order for %s scope',
  (scope) => {
    mockAppliedScope = scope;
    const html = renderToStaticMarkup(<PremiumsReportTable />);
    const labels = mockColumnLabels.mock.calls[0][0];
    expect(labels).toEqual(
      scope === 'reinsurer'
        ? [
            'Policy Number',
            ...common,
            'Fac Premium',
            "Insurer's Commission %",
            "Insurer's Commission Amount",
            'Net Premium Due iRisk Re',
            'Net Premium Due iRisk Re Paid',
          ]
        : [
            'Policy Number',
            'Reinsurer',
            ...common,
            'Cedant Premium Due',
            'Cedant Premium Paid',
            'Cedant Outstanding',
            'Payment Status',
            'Net Premium Due Reinsurer',
            'Net Premium Due Reinsurer Paid',
          ],
    );
    expect(html).not.toContain('settlement rows shown');
    expect(html).not.toContain('Exports: all filtered rows');
    expect(html).not.toContain('(Placement Groups)');
    expect(html).toContain('POL-SYNTHETIC');
    expect(html).not.toContain('Loading...');
  },
);
it('keeps the settlement KPI design without displaying a new Pending KPI', () => {
  const html = renderToStaticMarkup(<PremiumsKpiCards summary={summary} isLoading={false} />);
  expect(html).not.toContain('Pending');
});
it('keeps currency card titles and true totals without title suffixes', () => {
  const html = renderToStaticMarkup(
    <PremiumsCurrencySummaryCards summary={summary} isLoading={false} />,
  );
  for (const title of [
    'Gross Premium',
    'Due From Cedants',
    'Premium Received',
    'Cedant Outstanding',
    'Payable To Reinsurers',
    'Paid To Reinsurers',
    'Reinsurer Outstanding',
    'Total Brokerage',
  ])
    expect(html).toContain(title);
  expect(html).not.toContain('(Placement Groups)');
  expect(html).toContain('GHS');
});
it('keeps the original pagination counter structure without export-limit text', () => {
  const html = renderToStaticMarkup(
    <ReportRowsSummary page={2} pageSize={50} shown={1} total={51} />,
  );
  expect(html).toContain('51–51 of 51');
  expect(html).not.toContain('Exports');
  expect(html.match(/<span/g)).toHaveLength(1);
});
