import React, { type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { EndorsedReferencePill } from './EndorsedReferencePill';

type LookupResult = {
  data?: Array<{ status: 'VOID' | 'DRAFT' | 'CLOSED' }>;
  isFetching?: boolean;
  isError?: boolean;
};
const mockLookup = jest.fn<LookupResult, [string, { enabled?: boolean }]>();
jest.mock('@/hooks', () => ({
  usePlacementEndorsements: (id: string, options: { enabled?: boolean }) => mockLookup(id, options),
}));

type PillElement = ReactElement<{
  children: ReactNode;
  onPointerEnter?: () => void;
  onFocus?: () => void;
  tabIndex?: number;
  title?: string;
  'aria-busy'?: boolean;
}>;
const mockSetRequestedId = jest.fn<void, [unknown]>();
let state: jest.SpyInstance;
beforeEach(() => {
  mockLookup.mockReset().mockReturnValue({ data: [] });
  mockSetRequestedId.mockReset();
  state = jest.spyOn(React, 'useState').mockReturnValue([null, mockSetRequestedId]);
});
afterEach(() => state.mockRestore());

function pill(id = 'p1', deferred = true, endorsementCount?: number): PillElement {
  // Controlled hook state permits testing event wiring with the existing Node
  // runner. Actual mounted React/QueryClient behavior is also browser-verified.
  return EndorsedReferencePill({
    id,
    reference: 'POL-1',
    deferFetchUntilInteraction: deferred,
    endorsementCount,
  });
}

it('does not enable a deferred lookup when a report cell renders', () => {
  const element = pill();
  expect(mockLookup).toHaveBeenLastCalledWith('p1', { enabled: false });
  expect(element.props.tabIndex).toBe(0);
  expect(renderToStaticMarkup(element)).toContain('POL-1');
});

it.each(['onPointerEnter', 'onFocus'] as const)(
  'requests exactly the inspected placement on %s',
  (event) => {
    const element = pill();
    element.props[event]?.();
    expect(mockSetRequestedId).toHaveBeenCalledWith('p1');
    state.mockReturnValue(['p1', mockSetRequestedId]);
    pill();
    expect(mockLookup).toHaveBeenLastCalledWith('p1', { enabled: true });
  },
);

it('does not transfer interaction state to a different placement in a recycled row', () => {
  state.mockReturnValue(['p1', mockSetRequestedId]);
  pill('p2');
  expect(mockLookup).toHaveBeenLastCalledWith('p2', { enabled: false });
});

it.each([0, 2])('uses an authoritative supplied count of %s without fetching', (count) => {
  const element = pill('p1', true, count);
  expect(mockLookup).toHaveBeenLastCalledWith('p1', { enabled: false });
  expect(element.props.onPointerEnter).toBeUndefined();
  expect(element.props.onFocus).toBeUndefined();
  const html = renderToStaticMarkup(element);
  expect(html.includes('bg-green-500')).toBe(count > 0);
});

it('keeps existing eager callers unchanged', () => {
  const element = pill('p1', false);
  expect(mockLookup).toHaveBeenLastCalledWith('p1', { enabled: true });
  expect(element.props.onPointerEnter).toBeUndefined();
  expect(element.props.tabIndex).toBeUndefined();
});

it('counts all non-VOID endorsements, not only financially effective ones', () => {
  mockLookup.mockReturnValue({
    data: [{ status: 'CLOSED' }, { status: 'DRAFT' }, { status: 'VOID' }],
  });
  expect(renderToStaticMarkup(pill())).toContain('2 endorsements');
});

it('does not treat loading or failure as a known zero count', () => {
  state.mockReturnValue(['p1', mockSetRequestedId]);
  mockLookup.mockReturnValue({ isFetching: true });
  const loading = pill();
  expect(loading.props['aria-busy']).toBe(true);
  expect(renderToStaticMarkup(loading)).not.toContain('0 endorsements');
  mockLookup.mockReturnValue({ isError: true });
  const failed = pill();
  expect(failed.props.title).toContain('Open the placement for details');
  expect(renderToStaticMarkup(failed)).toContain('POL-1');
});
