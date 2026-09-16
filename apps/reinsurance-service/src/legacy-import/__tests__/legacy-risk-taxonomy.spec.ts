import {
  getLegacyRiskTaxonomyMappingCollisions,
  normalizeLegacyRiskTypeName,
  resolveLegacyRiskClass,
} from '../legacy-risk-taxonomy';

describe('legacy risk taxonomy', () => {
  it('resolves source names and mapping keys through the same whitespace normalization', () => {
    expect(resolveLegacyRiskClass('MARINE  INLAND TRANSIT')).toEqual({
      key: 'marine',
      name: 'Marine',
    });
    expect(resolveLegacyRiskClass('marine inland transit')).toEqual({
      key: 'marine',
      name: 'Marine',
    });
  });

  it('resolves ordinary case-only variants', () => {
    expect(resolveLegacyRiskClass('motor comprehensive')).toEqual({
      key: 'motor',
      name: 'Motor',
    });
    expect(resolveLegacyRiskClass('MOTOR COMPREHENSIVE')).toEqual({
      key: 'motor',
      name: 'Motor',
    });
  });

  it('preserves punctuation significance', () => {
    expect(resolveLegacyRiskClass('Counter Guarantee-Bid Bond')).toEqual({
      key: 'bond',
      name: 'Bond',
    });
    expect(resolveLegacyRiskClass('Counter Guarantee Bid Bond')).toBeNull();
  });

  it('keeps duplicate normalized source names safe when they share one parent', () => {
    expect(resolveLegacyRiskClass('Retention Bond')).toEqual({
      key: 'bond',
      name: 'Bond',
    });
    expect(resolveLegacyRiskClass(' retention   bond ')).toEqual({
      key: 'bond',
      name: 'Bond',
    });
  });

  it('has no mapping-key normalization collisions', () => {
    expect(getLegacyRiskTaxonomyMappingCollisions()).toEqual([]);
  });

  it('documents the canonical normalization behavior', () => {
    expect(normalizeLegacyRiskTypeName('  MARINE  INLAND TRANSIT  ')).toBe(
      'marine inland transit',
    );
    expect(normalizeLegacyRiskTypeName('Counter Guarantee-Bid Bond')).toBe(
      'counter guarantee-bid bond',
    );
  });
});
