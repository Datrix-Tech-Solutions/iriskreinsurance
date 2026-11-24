import {
  LEGACY_DATE_FIELD_TO_BASIS,
  REPORT_DATE_BASIS,
  reportDatePredicate,
} from './report-date-basis';

const range = {
  from: new Date('2026-01-01T00:00:00.000Z'),
  to: new Date('2026-01-31T23:59:59.999Z'),
};

const sqlOf = (basis: Parameters<typeof reportDatePredicate>[0]) =>
  reportDatePredicate(basis, range, 'tenant-1').sql;

describe('reportDatePredicate', () => {
  it('is empty without a range', () => {
    expect(reportDatePredicate('CLOSING_DATE', {}, 't').sql.trim()).toBe('');
  });

  it('defaults to the placement entry date', () => {
    expect(sqlOf(undefined)).toContain('p."createdAt"');
    expect(sqlOf('PLACEMENT_CREATED')).toContain('p."createdAt"');
    expect(sqlOf('PLACEMENT_CREATED')).not.toContain('inceptionDate');
  });

  it('uses original and endorsement closings for the closing date', () => {
    const sql = sqlOf('CLOSING_DATE');
    expect(sql).toContain('"PlacementClosing" pc_date');
    expect(sql).toContain('"PlacementEndorsementClosing" ec_date');
  });

  it('uses premium receipts for the premium payment date', () => {
    const sql = sqlOf('PREMIUM_PAYMENT_DATE');
    expect(sql).toContain('pay_date."type" = \'PREMIUM_RECEIVED\'');
    expect(sql).toContain('pay_date."paymentDate"');
  });

  it('maps every legacy Facultative field to a shared basis', () => {
    for (const basis of Object.values(LEGACY_DATE_FIELD_TO_BASIS)) {
      expect(REPORT_DATE_BASIS).toContain(basis);
    }
  });
});
