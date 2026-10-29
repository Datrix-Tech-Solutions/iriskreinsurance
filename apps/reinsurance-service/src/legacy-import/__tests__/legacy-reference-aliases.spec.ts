import {
  approvedLegacyReferenceAlias,
  parseLegacyReferenceAliases,
} from '../legacy-reference-aliases';
import { referenceAliasFixture } from './legacy-reference-aliases.fixture';

describe('parseLegacyReferenceAliases', () => {
  it('parses exact reviewed hashes and retains provenance deterministically', () => {
    const { artifact, provenance, file } = referenceAliasFixture();
    expect(file).toEqual({ ...artifact, ...provenance });
    expect(parseLegacyReferenceAliases(artifact, provenance)).toEqual(file);
  });

  it.each([null, [], {}, { schemaVersion: 2 }, { sourceSystem: 'other' }])(
    'rejects malformed artifacts: %p',
    (value) => {
      expect(() =>
        parseLegacyReferenceAliases(value, referenceAliasFixture().provenance),
      ).toThrow();
    },
  );

  it.each([
    { schemaVersion: 2 },
    { sourceSystem: 'other' },
    { tenantId: '' },
    { aliases: {} },
  ])('rejects invalid artifact metadata: %p', (patch) => {
    const { artifact, provenance } = referenceAliasFixture();
    expect(() =>
      parseLegacyReferenceAliases({ ...artifact, ...patch }, provenance),
    ).toThrow();
  });

  it.each([
    { alternateHash: '0'.repeat(64) },
    { canonicalHash: 'f'.repeat(64) },
    { alternateHash: 'invalid' },
    { legacyId: '1:other_field' },
    { offerIds: [] },
    { offerIds: ['1567', '1567'] },
    { offerIds: [1567] },
    { offerIds: ['1567x'] },
    { offerIds: [' 1567'] },
  ])('rejects invalid entries: %p', (patch) => {
    const { artifact, alias, provenance } = referenceAliasFixture();
    expect(() =>
      parseLegacyReferenceAliases(
        { ...artifact, aliases: [{ ...alias, ...patch }] },
        provenance,
      ),
    ).toThrow();
  });

  it.each([
    { section: 'OTHER' },
    { fieldType: 'NUMBER' },
    { required: true },
    { options: [] },
    { validationRules: {} },
  ])('rejects unsupported semantic declarations: %p', (patch) => {
    const { artifact, alias, provenance } = referenceAliasFixture();
    expect(() =>
      parseLegacyReferenceAliases(
        {
          ...artifact,
          aliases: [{ ...alias, semantics: { ...alias.semantics, ...patch } }],
        },
        provenance,
      ),
    ).toThrow();
  });

  it('rejects duplicated artifact entries even with partially overlapping offer lists', () => {
    const { artifact, alias, provenance } = referenceAliasFixture();
    for (const duplicate of [alias, { ...alias, offerIds: ['3110', '9999'] }]) {
      expect(() =>
        parseLegacyReferenceAliases(
          { ...artifact, aliases: [alias, duplicate] },
          provenance,
        ),
      ).toThrow('Duplicate approved reference aliases');
    }
  });

  it('does not normalize punctuation when reviewing label equivalence', () => {
    const { artifact, alias, provenance, hash } = referenceAliasFixture();
    expect(() =>
      parseLegacyReferenceAliases(
        {
          ...artifact,
          aliases: [
            {
              ...alias,
              sourceLabel: 'Vehicle/Make',
              alternateHash: hash('Vehicle/Make'),
            },
          ],
        },
        provenance,
      ),
    ).toThrow('Invalid approved reference alias');
  });

  it('rejects identical alternate and canonical hashes', () => {
    const { artifact, alias, provenance } = referenceAliasFixture();
    expect(() =>
      parseLegacyReferenceAliases(
        {
          ...artifact,
          aliases: [
            {
              ...alias,
              sourceLabel: alias.canonicalLabel,
              alternateHash: alias.canonicalHash,
            },
          ],
        },
        provenance,
      ),
    ).toThrow();
  });
});

describe('approvedLegacyReferenceAlias', () => {
  it('accepts only the exact approved hash pair without mutating the stored map on repeat', () => {
    const { input, alias } = referenceAliasFixture();
    const before = JSON.stringify(input);
    Object.freeze(input.map);
    const expected = {
      offerId: '1567',
      legacyId: alias.legacyId,
      alternateHash: alias.alternateHash,
      canonicalHash: alias.canonicalHash,
      currentId: alias.currentId,
      evidenceReference: alias.evidenceReference,
    };
    expect(approvedLegacyReferenceAlias(input)).toEqual(expected);
    expect(approvedLegacyReferenceAlias(input)).toEqual(expected);
    expect(JSON.stringify(input)).toBe(before);
  });

  it.each(['1567', '1955', '3066', '3110'])(
    'accepts explicitly listed offer %s',
    (offerId) => {
      expect(
        approvedLegacyReferenceAlias({
          ...referenceAliasFixture().input,
          offerId,
        }),
      ).toEqual(expect.objectContaining({ offerId }));
    },
  );

  it.each([
    '1',
    '1566',
    '1568',
    '1954',
    '1956',
    '3065',
    '3067',
    '3109',
    '3111',
    '01567',
    '1567 ',
    '9999',
  ])('does not extend the reviewed allowlist to %s', (offerId) => {
    expect(
      approvedLegacyReferenceAlias({
        ...referenceAliasFixture().input,
        offerId,
      }),
    ).toBeUndefined();
  });

  it('does not accept an absent file or an unreviewed label hash', () => {
    const { input } = referenceAliasFixture();
    expect(
      approvedLegacyReferenceAlias({ ...input, file: undefined }),
    ).toBeUndefined();
    for (const key of [
      'vehicle make',
      'Vehicle/Make',
      'Vehicle-Make',
      'VEHICLE  MAKE',
    ]) {
      expect(
        approvedLegacyReferenceAlias({
          ...input,
          field: { ...input.field, key },
        }),
      ).toBeUndefined();
    }
  });

  it('rejects a cross-tenant or cross-source artifact', () => {
    const { input, file } = referenceAliasFixture();
    expect(() =>
      approvedLegacyReferenceAlias({ ...input, tenantId: 'another-tenant' }),
    ).toThrow('target tenant/source system');
    expect(() =>
      approvedLegacyReferenceAlias({
        ...input,
        file: { ...file, sourceSystem: 'other' as typeof file.sourceSystem },
      }),
    ).toThrow('target tenant/source system');
  });

  it.each([
    { id: 'other-field' },
    { tenantId: 'other-tenant' },
    { riskTypeId: 'other-type' },
    { label: 'vehicle make' },
    { section: 'OTHER' },
    { fieldKey: 'other_key' },
    { fieldType: 'NUMBER' },
    { required: true },
    { options: [] },
    { validationRules: {} },
    { isActive: false },
  ])('rejects changed field semantics/ownership: %p', (patch) => {
    const { input, currentField } = referenceAliasFixture();
    expect(() =>
      approvedLegacyReferenceAlias({
        ...input,
        currentField: { ...currentField, ...patch },
      }),
    ).toThrow('semantic/ownership mismatch');
  });

  it.each([
    { id: 'other-map' },
    { importRunId: 'other-run' },
    { currentId: 'other-field' },
    { currentModel: 'RiskType' },
    { rawHash: '0'.repeat(64) },
  ])('rejects changed map identity or unknown canonical hash: %p', (patch) => {
    const { input, map } = referenceAliasFixture();
    expect(() =>
      approvedLegacyReferenceAlias({ ...input, map: { ...map, ...patch } }),
    ).toThrow('semantic/ownership mismatch');
  });

  it.each([
    { id: 'other-type' },
    { tenantId: 'other-tenant' },
    { riskClassId: 'other-class' },
  ])('rejects changed risk type ownership: %p', (patch) => {
    const { input, riskType } = referenceAliasFixture();
    expect(() =>
      approvedLegacyReferenceAlias({
        ...input,
        riskType: { ...riskType, ...patch },
      }),
    ).toThrow('semantic/ownership mismatch');
  });

  it.each([
    { currentField: undefined },
    { riskType: undefined },
    { expectedRiskTypeId: 'other-type' },
    { expectedRiskClassId: 'other-class' },
    { expectedRiskTypeId: undefined },
    { expectedRiskClassId: undefined },
  ])(
    'rejects missing metadata or conflicting expected parents: %p',
    (patch) => {
      expect(() =>
        approvedLegacyReferenceAlias({
          ...referenceAliasFixture().input,
          ...patch,
        }),
      ).toThrow('semantic/ownership mismatch');
    },
  );
});
