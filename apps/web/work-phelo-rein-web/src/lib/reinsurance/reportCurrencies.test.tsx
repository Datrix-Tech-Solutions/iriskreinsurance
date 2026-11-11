import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { reportCurrencyRows, reportCurrencyOptions } from './reportCurrencies';
import { CurrencyAmountListCard } from '@/components/molecules/reinsurance/stats/CurrencyAmountListCard';

it.each(['denied', 'paginated', 'archived', 'missing'])(
  'keeps report currency values when metadata is %s',
  () => {
    const amounts = new Map([
      ['GHS', 1000],
      ['USD', 500],
      ['EUR', 25],
    ]);
    const html = renderToStaticMarkup(
      <CurrencyAmountListCard
        title="Amount"
        columnLabel="Amount"
        amountsByCode={amounts}
        currencies={[]}
      />,
    );
    for (const code of ['GHS', 'USD', 'EUR']) expect(html).toContain(code);
    expect(reportCurrencyRows(amounts).map((row) => row.amount)).toEqual([25, 1000, 500]);
  },
);
it('keeps zero, credit and unavailable amounts distinct', () => {
  expect(
    reportCurrencyRows(
      new Map([
        ['USD', 0],
        ['GHS', -50],
      ]),
      new Map([['EUR', 10]]),
    ),
  ).toEqual([
    { id: 'EUR', isoCode: 'EUR', amount: null, subAmount: 10 },
    { id: 'GHS', isoCode: 'GHS', amount: -50, subAmount: null },
    { id: 'USD', isoCode: 'USD', amount: 0, subAmount: null },
  ]);
  const html = renderToStaticMarkup(
    <CurrencyAmountListCard
      unavailable
      title="NIC"
      columnLabel="NIC"
      amountsByCode={new Map([['GHS', 0]])}
    />,
  );
  expect(html).toContain('Not available from this report');
  expect(html).not.toContain('0.00');
});
it('retains filter codes that have no settings metadata', () => {
  expect(reportCurrencyOptions([{ value: 'GHS', label: 'Cedi' }], ['USD', 'EUR'])).toEqual([
    { value: 'GHS', label: 'Cedi' },
    { value: 'EUR', label: 'EUR' },
    { value: 'USD', label: 'USD' },
  ]);
});
it('renders genuine empty results separately', () => {
  const html = renderToStaticMarkup(
    <CurrencyAmountListCard
      compactEmpty
      title="Amount"
      columnLabel="Amount"
      amountsByCode={new Map()}
      emptyMessage="No filtered rows"
    />,
  );
  expect(html).toContain('No filtered rows');
  expect(html).not.toContain('Not available');
});

it('preserves existing currency display order and appends missing report codes', () => {
  const amounts = new Map([
    ['EUR', 25],
    ['GHS', 1000],
    ['USD', 500],
  ]);
  expect(
    reportCurrencyRows(amounts, undefined, [{ isoCode: 'USD' }, { isoCode: 'GHS' }]).map(
      (row) => row.isoCode,
    ),
  ).toEqual(['USD', 'GHS', 'EUR']);
  expect(
    reportCurrencyOptions(
      [
        { value: 'USD', label: 'US dollar' },
        { value: 'GHS', label: 'Cedi' },
      ],
      ['EUR', 'USD'],
    ).map((row) => row.value),
  ).toEqual(['USD', 'GHS', 'EUR']);
});
