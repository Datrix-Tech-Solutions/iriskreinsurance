import { riskFieldDefinitionHash } from '../legacy-hash';
import { LEGACY_SOURCE_SYSTEM } from '../legacy-import.types';
import {
  approvedLegacyReferenceAlias,
  LegacyReferenceAlias,
  parseLegacyReferenceAliases,
} from '../legacy-reference-aliases';

// Synthetic review artifact and row metadata; these are not migration evidence.
export function referenceAliasFixture() {
  const tenantId = '00000000-0000-4000-8000-000000000001';
  const riskTypeId = '00000000-0000-4000-8000-000000000002';
  const riskClassId = '00000000-0000-4000-8000-000000000003';
  const currentId = '00000000-0000-4000-8000-000000000004';
  const hash = (key: string) =>
    riskFieldDefinitionHash({
      riskTypeLegacyId: '1',
      key,
      normalizedKey: 'vehicle_make',
    });
  const alias: LegacyReferenceAlias = {
    legacyId: '1:vehicle_make',
    offerIds: ['1567', '1955', '3066', '3110'],
    sourceLabel: 'VEHICLE MAKE',
    canonicalLabel: 'Vehicle Make',
    alternateHash: hash('VEHICLE MAKE'),
    canonicalHash: hash('Vehicle Make'),
    mapId: '00000000-0000-4000-8000-000000000005',
    importRunId: '00000000-0000-4000-8000-000000000006',
    currentId,
    riskTypeLegacyId: '1',
    semantics: {
      riskTypeId,
      riskClassId,
      section: 'OFFER_DETAILS',
      fieldKey: 'vehicle_make',
      fieldType: 'TEXT',
      required: false,
      options: null,
      validationRules: null,
    },
    evidenceReference: 'synthetic-unit-test-review',
  };
  const artifact = {
    schemaVersion: 1,
    tenantId,
    sourceSystem: LEGACY_SOURCE_SYSTEM,
    aliases: [alias],
  };
  const provenance = {
    sourceFilePath: 'synthetic-reference-aliases.json',
    sourceFileHash: 'a'.repeat(64),
  };
  const file = parseLegacyReferenceAliases(artifact, provenance);
  const map = {
    id: alias.mapId,
    importRunId: alias.importRunId,
    currentId,
    currentModel: 'RiskTypeField',
    rawHash: alias.canonicalHash,
  };
  const currentField = {
    id: currentId,
    tenantId,
    riskTypeId,
    label: alias.canonicalLabel,
    section: 'OFFER_DETAILS',
    fieldKey: 'vehicle_make',
    fieldType: 'TEXT',
    required: false,
    options: null,
    validationRules: null,
    isActive: true,
  };
  const riskType = { id: riskTypeId, tenantId, riskClassId };
  const input: Parameters<typeof approvedLegacyReferenceAlias>[0] = {
    file,
    tenantId,
    offerId: '1567',
    riskTypeLegacyId: '1',
    field: { key: alias.sourceLabel, normalizedKey: 'vehicle_make' },
    map,
    currentField,
    riskType,
    expectedRiskTypeId: riskTypeId,
    expectedRiskClassId: riskClassId,
  };
  return {
    alias,
    artifact,
    provenance,
    file,
    map,
    currentField,
    riskType,
    input,
    hash,
  };
}
