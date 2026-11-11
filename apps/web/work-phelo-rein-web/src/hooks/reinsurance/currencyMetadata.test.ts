import { fetchAllCurrencyMetadata } from './useCurrencies';
import { api } from '@/lib/api';
jest.mock('@/lib/api', () => ({ api: { get: jest.fn() } }));
beforeEach(() => jest.clearAllMocks());
it('retrieves every metadata page instead of silently limiting filters to page one', async () => {
  jest
    .mocked(api.get)
    .mockResolvedValueOnce({ data: { items: [{ isoCode: 'GHS' }], meta: { totalPages: 2 } } })
    .mockResolvedValueOnce({
      data: { items: [{ isoCode: 'USD' }, { isoCode: 'EUR' }], meta: { totalPages: 2 } },
    });
  expect((await fetchAllCurrencyMetadata()).map((row) => row.isoCode)).toEqual([
    'GHS',
    'USD',
    'EUR',
  ]);
  expect(api.get).toHaveBeenNthCalledWith(2, expect.any(String), {
    params: { page: 2, limit: 100 },
  });
});
it('retains denied metadata as an error rather than fabricating a currency list', async () => {
  const error = { response: { status: 403 } };
  jest.mocked(api.get).mockRejectedValue(error);
  await expect(fetchAllCurrencyMetadata()).rejects.toBe(error);
});
it('supports the existing unpaginated response without a loop', async () => {
  jest.mocked(api.get).mockResolvedValue({ data: [{ isoCode: 'USD' }] });
  expect((await fetchAllCurrencyMetadata()).map((row) => row.isoCode)).toEqual(['USD']);
  expect(api.get).toHaveBeenCalledTimes(1);
});
