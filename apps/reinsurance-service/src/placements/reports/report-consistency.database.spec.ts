import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import ExcelJS from 'exceljs';
import { PrismaService } from '../../prisma/prisma.service';
import { ReinsuranceMoneyHelper } from '../reinsurance-money.helper';
import { PremiumsReportService } from './premiums-report.service';
import { CedantsReportService } from './cedants-report.service';
import { ReinsurersReportService } from './reinsurers-report.service';
import { FacultativeReportService } from './facultative-report.service';
import { BrokerageReportService } from './brokerage-report.service';
import { ClaimsReportService } from './claims-report.service';
import {
  createFinancialReportFixture,
  financialDatabaseDescribe,
  FinancialReportFixture,
} from './testing/financial-report-database.fixture';

async function csvRows(csv: string): Promise<string[][]> {
  const workbook = new ExcelJS.Workbook();
  const sheet = await workbook.csv.read(Readable.from([csv]), {
    map: (value: string) => value,
  });
  const rows: string[][] = [];
  sheet.eachRow((row) => {
    const cells: string[] = [];
    for (let index = 1; index <= sheet.columnCount; index += 1) {
      const value = row.getCell(index).value;
      if (value == null) cells.push('');
      else if (typeof value === 'string' || typeof value === 'number')
        cells.push(String(value));
      else throw new Error('CSV oracle expected scalar source cells');
    }
    rows.push(cells);
  });
  return rows;
}
function xlsRows(html: string): string[][] {
  const decode = (value: string) =>
    value
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&');
  return [...html.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((row) =>
    [...row[1].matchAll(/<td>([\s\S]*?)<\/td>/g)].map((cell) =>
      decode(cell[1]),
    ),
  );
}

financialDatabaseDescribe(
  'Report consistency and pagination (PostgreSQL)',
  () => {
    let f: FinancialReportFixture;
    let premiums: PremiumsReportService;
    let cedants: CedantsReportService;
    let reinsurers: ReinsurersReportService;
    let facultative: FacultativeReportService;
    let brokerage: BrokerageReportService;
    let claims: ClaimsReportService;
    let targetReinsurerId: string;
    let targetPlacementId: string;

    beforeAll(async () => {
      f = await createFinancialReportFixture();
      const db = f.prisma as unknown as PrismaService;
      const money = new ReinsuranceMoneyHelper();
      premiums = new PremiumsReportService(db, money);
      cedants = new CedantsReportService(db, money);
      reinsurers = new ReinsurersReportService(db, money);
      facultative = new FacultativeReportService(db, money);
      brokerage = new BrokerageReportService(db, money);
      claims = new ClaimsReportService(db, money);
      for (let i = 0; i < 51; i += 1) {
        const cedant = await f.counterparty(`Synthetic cedant ${i}`, 'CEDANT');
        const reinsurer = await f.counterparty(`Synthetic reinsurer ${i}`);
        const currency = i === 50 ? 'USD' : 'GHS';
        const placement = await f.placement({
          cedantId: cedant.id,
          policyNumber: `P-${String(i).padStart(3, '0')}`,
          currency,
        });
        const participant = await f.participant(placement.id, reinsurer.id);
        const closing = await f.closing(placement.id, participant.id, {
          currency,
        });
        const claim = await f.claim(placement.id, { currency });
        await f.allocation(placement.id, claim.id, reinsurer.id, {
          participantId: participant.id,
          placementClosingId: closing.id,
        });
        if (i === 50) {
          targetPlacementId = placement.id;
          targetReinsurerId = reinsurer.id;
          await f.payment(placement.id, reinsurer.id, {
            currency,
            closingId: closing.id,
            amount: '300',
          });
          const second = await f.participant(placement.id, reinsurer.id, {
            role: 'CO_REINSURER',
          });
          await f.closing(placement.id, second.id, { currency });
        }
      }
    });
    afterAll(async () => f?.disconnect());

    const families = [
      'premiums',
      'cedants',
      'reinsurers',
      'facultative',
      'brokerage',
      'claims',
    ] as const;
    function find(
      name: (typeof families)[number],
      tenantId: string,
      page: number,
    ) {
      const params = { page, limit: 50 };
      switch (name) {
        case 'premiums':
          return premiums.findPremiums(tenantId, params);
        case 'cedants':
          return cedants.findCedants(tenantId, params);
        case 'reinsurers':
          return reinsurers.findReinsurers(tenantId, params);
        case 'facultative':
          return facultative.findFacultative(tenantId, params);
        case 'brokerage':
          return brokerage.findBrokerage(tenantId, {
            ...params,
            scope: 'cedant',
          });
        case 'claims':
          return claims.findClaims(tenantId, { ...params, scope: 'cedant' });
      }
    }
    it.each(families)(
      '%s preserves full count and summary beyond the last page',
      async (name) => {
        const first = await find(name, f.tenantId, 1);
        const last = await find(name, f.tenantId, 3);
        expect(first.meta.total).toBe(51);
        expect(last.items).toEqual([]);
        expect(last.meta).toEqual({
          page: 3,
          limit: 50,
          total: 51,
          totalPages: 2,
        });
        expect(last.summary).toEqual(first.summary);
      },
    );
    it.each(families)(
      '%s distinguishes a genuine empty tenant',
      async (name) => {
        const result = await find(name, randomUUID(), 3);
        expect(result.items).toEqual([]);
        expect(result.meta).toEqual({
          page: 3,
          limit: 50,
          total: 0,
          totalPages: 0,
        });
      },
    );
    it('filters actual participant settlement rows before placement-group pagination', async () => {
      const unfiltered = await premiums.findPremiums(f.tenantId, {
        page: 1,
        limit: 50,
        sortBy: 'policyNumber',
        sortOrder: 'asc',
      });
      expect(unfiltered.items.some((row) => row.id === targetPlacementId)).toBe(
        false,
      );
      const filtered = await premiums.findPremiums(f.tenantId, {
        page: 1,
        limit: 50,
        scope: 'reinsurer',
        reinsurerId: [targetReinsurerId],
        settlementStatus: ['part'],
      });
      expect(filtered.meta.total).toBe(1);
      expect(filtered.items[0].id).toBe(targetPlacementId);
      expect(filtered.items[0].reinsurers).toHaveLength(1);
      expect(filtered.items[0].reinsurers[0].closingId).toBeTruthy();
      expect(filtered.items[0].reinsurers[0].settlementStatus).toBe('part');
      expect(filtered.items[0].reinsurers[0]).toMatchObject({
        reinsurerId: targetReinsurerId,
        paidAmount: 300,
        outstandingAmount: 500,
      });
      expect(filtered.summary.totalsByCurrency).toEqual([
        expect.objectContaining({
          currency: 'USD',
          participantCount: 1,
          grossPremium: 1000,
          reinsurerPayable: 800,
          reinsurerDisbursed: 300,
          reinsurerOutstanding: 500,
        }),
      ]);
      const all = await premiums.findPremiums(f.tenantId, {
        scope: 'reinsurer',
        reinsurerId: [targetReinsurerId],
      });
      expect(all.meta.total).toBe(1);
      expect(all.items[0].reinsurers).toHaveLength(2);
      expect(all.summary.participantCount).toBe(2);
    });
    it.each(families)(
      '%s CSV and XLS contain identical logical rows over the full filtered set',
      async (name) => {
        let csv: string;
        let xls: string;
        switch (name) {
          case 'premiums': {
            const params = {
              page: 3,
              limit: 1,
              scope: 'reinsurer' as const,
              reinsurerId: [targetReinsurerId],
              settlementStatus: ['part' as const],
            };
            csv = await premiums.exportPremiumsCsv(f.tenantId, params);
            xls = await premiums.exportPremiumsExcel(f.tenantId, params);
            break;
          }
          case 'cedants':
            csv = await cedants.exportCedantsCsv(f.tenantId, {});
            xls = await cedants.exportCedantsExcel(f.tenantId, {});
            break;
          case 'reinsurers':
            csv = await reinsurers.exportReinsurersCsv(f.tenantId, {});
            xls = await reinsurers.exportReinsurersExcel(f.tenantId, {});
            break;
          case 'facultative':
            csv = await facultative.exportFacultativeCsv(f.tenantId, {});
            xls = await facultative.exportFacultativeExcel(f.tenantId, {});
            break;
          case 'brokerage':
            csv = await brokerage.exportBrokerageCsv(f.tenantId, {});
            xls = await brokerage.exportBrokerageExcel(f.tenantId, {});
            break;
          case 'claims':
            csv = await claims.exportClaimsCsv(f.tenantId, {});
            xls = await claims.exportClaimsExcel(f.tenantId, {});
            break;
        }
        const logical = await csvRows(csv);
        expect(xlsRows(xls)).toEqual(logical);
        if (name === 'premiums') {
          expect(logical).toHaveLength(2);
          expect(logical[0]).toEqual([
            'Policy Number',
            'Reinsurer',
            'Insured',
            'Policy Type',
            'Cedant',
            'Offer Date',
            'Date Closed',
            'Inception Date',
            'Expiry Date',
            'Currency',
            '100% S.I',
            '100% Premium',
            'Fac Share',
            'Fac Premium',
            "Insurer's Commission %",
            "Insurer's Commission Amount",
            'Brokerage',
            'Net Premium Due Reinsurer',
            'Net Premium Due Reinsurer Paid',
            'Cedant Premium Due',
            'Cedant Premium Paid',
            'Mandatory Deductions',
            'Effective Settlement',
            'Cedant Outstanding',
            'Payment Status',
          ]);
          expect(logical[1]).toHaveLength(25);
          expect(logical[1][17]).toBe('800');
          expect(logical[1][18]).toBe('300');
          expect(csv).toContain('USD');
          expect(csv).not.toContain('GHS');
        } else expect(logical.length).toBeGreaterThan(50);
      },
    );
  },
);
financialDatabaseDescribe(
  'Premiums scoped settlement edge cases (PostgreSQL)',
  () => {
    it('filters replacement payees and preserves the old payee credit without transferring cash', async () => {
      const isolated = await createFinancialReportFixture();
      try {
        const service = new PremiumsReportService(
          isolated.prisma as unknown as PrismaService,
          new ReinsuranceMoneyHelper(),
        );
        const old = await isolated.counterparty();
        const replacement = await isolated.counterparty();
        const placement = await isolated.placement();
        const original = await isolated.participant(placement.id, old.id);
        const closing = await isolated.closing(placement.id, original.id);
        await isolated.payment(placement.id, old.id, {
          closingId: closing.id,
          amount: '300',
        });
        const endorsement = await isolated.endorsement(placement.id);
        const participant = await isolated.endorsementParticipant(
          placement.id,
          endorsement.id,
          replacement.id,
          original.id,
        );
        await isolated.endorsementClosing(
          placement.id,
          endorsement.id,
          participant.id,
        );
        const selected = await service.findPremiums(isolated.tenantId, {
          scope: 'reinsurer',
          reinsurerId: [replacement.id],
          settlementStatus: ['outstanding'],
        });
        expect(selected.items[0].reinsurers).toHaveLength(1);
        expect(selected.items[0].reinsurers[0]).toMatchObject({
          reinsurerId: replacement.id,
          netPremium: 1200,
          paidAmount: 0,
          outstandingAmount: 1200,
        });
        const credit = await service.findPremiums(isolated.tenantId, {
          scope: 'reinsurer',
          reinsurerId: [old.id],
          settlementStatus: ['paid'],
        });
        expect(credit.items[0].reinsurers[0]).toMatchObject({
          rowKind: 'SETTLEMENT_ONLY',
          paidAmount: 300,
          outstandingAmount: -300,
        });
        expect(credit.summary.participantCount).toBe(0);
        expect(credit.summary.totalsByCurrency[0]).toMatchObject({
          reinsurerPayable: 0,
          reinsurerDisbursed: 300,
          reinsurerOutstanding: -300,
        });
      } finally {
        await isolated.disconnect();
      }
    });

    it('keeps recorded disbursements pending and applies inclusive date boundaries to the same scoped population', async () => {
      const isolated = await createFinancialReportFixture();
      try {
        const service = new PremiumsReportService(
          isolated.prisma as unknown as PrismaService,
          new ReinsuranceMoneyHelper(),
        );
        const reinsurer = await isolated.counterparty();
        const placement = await isolated.placement();
        const participant = await isolated.participant(
          placement.id,
          reinsurer.id,
        );
        const closing = await isolated.closing(placement.id, participant.id);
        await isolated.payment(placement.id, reinsurer.id, {
          closingId: closing.id,
          amount: '300',
          status: 'RECORDED',
          bankConfirmedAt: null,
          bankConfirmedByUserId: null,
        });
        const params = {
          scope: 'reinsurer' as const,
          reinsurerId: [reinsurer.id],
          settlementStatus: ['pending' as const],
          dateBasis: 'PLACEMENT_CREATED' as const,
          dateFrom: '2026-01-01',
          dateTo: '2026-01-01',
        };
        const pending = await service.findPremiums(isolated.tenantId, params);
        expect(pending.meta.total).toBe(1);
        expect(pending.items[0].reinsurers[0]).toMatchObject({
          settlementStatus: 'pending',
          pendingAmount: 300,
          paidAmount: 0,
          outstandingAmount: 800,
        });
        expect(pending.summary.settlementCounts.pending).toBe(1);
        const outside = await service.findPremiums(isolated.tenantId, {
          ...params,
          dateFrom: '2026-01-02',
          dateTo: '2026-01-02',
        });
        expect(outside.meta.total).toBe(0);
        expect(outside.summary.totalsByCurrency).toEqual([]);
      } finally {
        await isolated.disconnect();
      }
    });
  },
);
