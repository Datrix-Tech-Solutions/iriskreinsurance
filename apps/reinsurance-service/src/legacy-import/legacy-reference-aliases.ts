import { createHash } from 'crypto';
import { readFile } from 'fs/promises';
import { riskFieldDefinitionHash } from './legacy-hash';
import { LEGACY_SOURCE_SYSTEM } from './legacy-import.types';

export type LegacyReferenceAlias = {
  legacyId: string;
  offerIds: string[];
  sourceLabel: string;
  canonicalLabel: string;
  alternateHash: string;
  canonicalHash: string;
  mapId: string;
  importRunId: string;
  currentId: string;
  riskTypeLegacyId: string;
  semantics: {
    riskTypeId: string;
    riskClassId: string;
    section: 'OFFER_DETAILS';
    fieldKey: string;
    fieldType: 'TEXT';
    required: false;
    options: null;
    validationRules: null;
  };
  evidenceReference: string;
};

export type LegacyReferenceAliasFile = {
  schemaVersion: 1;
  tenantId: string;
  sourceSystem: typeof LEGACY_SOURCE_SYSTEM;
  aliases: LegacyReferenceAlias[];
  sourceFilePath: string;
  sourceFileHash: string;
};

export type LegacyReferenceAliasEvidence = {
  offerId: string;
  legacyId: string;
  alternateHash: string;
  canonicalHash: string;
  currentId: string;
  evidenceReference: string;
};

type AliasMap = {
  id?: string;
  importRunId?: string;
  currentId: string;
  currentModel: string;
  rawHash: string;
};

type AliasField = {
  id: string;
  tenantId: string;
  riskTypeId: string;
  label: string;
  section: string;
  fieldKey: string;
  fieldType: string;
  required: boolean;
  options: unknown;
  validationRules: unknown;
  isActive: boolean;
};

/** Explicit reviewed hash aliases only. No fuzzy lookup or stored-map rewrite. */
export function approvedLegacyReferenceAlias(input: {
  file?: LegacyReferenceAliasFile;
  tenantId: string;
  offerId: string;
  riskTypeLegacyId: string;
  field: { key: string; normalizedKey: string };
  map: AliasMap;
  currentField?: AliasField;
  riskType?: { id: string; tenantId: string; riskClassId: string };
  expectedRiskTypeId?: string;
  expectedRiskClassId?: string;
}): LegacyReferenceAliasEvidence | undefined {
  const { file, map, currentField: current, riskType } = input;
  if (!file) return undefined;
  assertLegacyAliasTenant(file, input.tenantId);
  const legacyId = `${input.riskTypeLegacyId}:${input.field.normalizedKey}`;
  const alternateHash = riskFieldDefinitionHash({
    riskTypeLegacyId: input.riskTypeLegacyId,
    key: input.field.key,
    normalizedKey: input.field.normalizedKey,
  });
  const alias = file.aliases.find(
    (entry) =>
      entry.legacyId === legacyId &&
      entry.alternateHash === alternateHash &&
      entry.offerIds.includes(input.offerId),
  );
  if (!alias) return undefined;
  const expected = alias.semantics;
  if (
    map.currentModel !== 'RiskTypeField' ||
    map.id !== alias.mapId ||
    map.importRunId !== alias.importRunId ||
    map.currentId !== alias.currentId ||
    map.rawHash !== alias.canonicalHash ||
    alias.riskTypeLegacyId !== input.riskTypeLegacyId ||
    alias.sourceLabel !== input.field.key ||
    !current ||
    current.id !== alias.currentId ||
    current.tenantId !== input.tenantId ||
    current.label !== alias.canonicalLabel ||
    current.riskTypeId !== expected.riskTypeId ||
    current.riskTypeId !== input.expectedRiskTypeId ||
    !riskType ||
    riskType.id !== current.riskTypeId ||
    riskType.tenantId !== input.tenantId ||
    riskType.riskClassId !== expected.riskClassId ||
    riskType.riskClassId !== input.expectedRiskClassId ||
    current.section !== expected.section ||
    current.fieldKey !== expected.fieldKey ||
    current.fieldKey !== input.field.normalizedKey ||
    current.fieldType !== expected.fieldType ||
    current.required !== expected.required ||
    current.options !== null ||
    current.validationRules !== null ||
    !current.isActive ||
    riskFieldDefinitionHash({
      riskTypeLegacyId: input.riskTypeLegacyId,
      key: current.label,
      normalizedKey: current.fieldKey,
    }) !== map.rawHash
  ) {
    throw new Error(
      `Approved reference alias semantic/ownership mismatch: ${legacyId}`,
    );
  }
  return {
    offerId: input.offerId,
    legacyId,
    alternateHash,
    canonicalHash: map.rawHash,
    currentId: map.currentId,
    evidenceReference: alias.evidenceReference,
  };
}

export function assertLegacyAliasTenant(
  file: LegacyReferenceAliasFile | undefined,
  tenantId: string,
) {
  if (
    file &&
    (file.tenantId !== tenantId || file.sourceSystem !== LEGACY_SOURCE_SYSTEM)
  ) {
    throw new Error(
      'Reference aliases do not belong to the target tenant/source system.',
    );
  }
}

export async function readLegacyReferenceAliases(
  sourceFilePath: string,
): Promise<LegacyReferenceAliasFile> {
  const contents = await readFile(sourceFilePath, 'utf8');
  const value: unknown = JSON.parse(contents);
  return parseLegacyReferenceAliases(value, {
    sourceFilePath,
    sourceFileHash: createHash('sha256').update(contents).digest('hex'),
  });
}

export function parseLegacyReferenceAliases(
  value: unknown,
  provenance: { sourceFilePath: string; sourceFileHash: string },
): LegacyReferenceAliasFile {
  const root = object(value);
  if (
    root.schemaVersion !== 1 ||
    root.sourceSystem !== LEGACY_SOURCE_SYSTEM ||
    !Array.isArray(root.aliases)
  ) {
    throw new Error('Invalid approved reference-alias artifact.');
  }
  const aliases = root.aliases.map((value: unknown): LegacyReferenceAlias => {
    const row = object(value);
    const semantics = object(row.semantics);
    if (
      !Array.isArray(row.offerIds) ||
      row.offerIds.length === 0 ||
      !row.offerIds.every(
        (id: unknown) => typeof id === 'string' && /^\d+$/.test(id),
      ) ||
      semantics.section !== 'OFFER_DETAILS' ||
      semantics.fieldType !== 'TEXT' ||
      semantics.required !== false ||
      semantics.options !== null ||
      semantics.validationRules !== null
    )
      throw new Error(
        'Only explicit TEXT OFFER_DETAILS reference aliases are supported.',
      );
    const offerIds: string[] = row.offerIds.map((id: unknown) => string(id));
    const alias: LegacyReferenceAlias = {
      legacyId: string(row.legacyId),
      offerIds,
      sourceLabel: string(row.sourceLabel),
      canonicalLabel: string(row.canonicalLabel),
      alternateHash: string(row.alternateHash),
      canonicalHash: string(row.canonicalHash),
      mapId: string(row.mapId),
      importRunId: string(row.importRunId),
      currentId: string(row.currentId),
      riskTypeLegacyId: string(row.riskTypeLegacyId),
      evidenceReference: string(row.evidenceReference),
      semantics: {
        riskTypeId: string(semantics.riskTypeId),
        riskClassId: string(semantics.riskClassId),
        section: 'OFFER_DETAILS',
        fieldKey: string(semantics.fieldKey),
        fieldType: 'TEXT',
        required: false,
        options: null,
        validationRules: null,
      },
    };
    const normalizeLabel = (label: string) =>
      label.trim().replace(/\s+/g, ' ').toLowerCase();
    if (
      alias.legacyId !==
        `${alias.riskTypeLegacyId}:${alias.semantics.fieldKey}` ||
      normalizeLabel(alias.sourceLabel) !==
        normalizeLabel(alias.canonicalLabel) ||
      !/^[a-f0-9]{64}$/.test(alias.alternateHash) ||
      !/^[a-f0-9]{64}$/.test(alias.canonicalHash) ||
      alias.alternateHash === alias.canonicalHash ||
      riskFieldDefinitionHash({
        riskTypeLegacyId: alias.riskTypeLegacyId,
        key: alias.sourceLabel,
        normalizedKey: alias.semantics.fieldKey,
      }) !== alias.alternateHash ||
      riskFieldDefinitionHash({
        riskTypeLegacyId: alias.riskTypeLegacyId,
        key: alias.canonicalLabel,
        normalizedKey: alias.semantics.fieldKey,
      }) !== alias.canonicalHash ||
      new Set(offerIds).size !== offerIds.length
    )
      throw new Error(`Invalid approved reference alias: ${alias.legacyId}`);
    return alias;
  });
  const keys = aliases.flatMap((alias) =>
    alias.offerIds.map(
      (offerId) => `${offerId}:${alias.legacyId}:${alias.alternateHash}`,
    ),
  );
  if (new Set(keys).size !== keys.length)
    throw new Error('Duplicate approved reference aliases.');
  return {
    schemaVersion: 1,
    tenantId: string(root.tenantId),
    sourceSystem: LEGACY_SOURCE_SYSTEM,
    aliases,
    ...provenance,
  };
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid reference-alias object.');
  return value as Record<string, unknown>;
}
function string(value: unknown): string {
  if (typeof value !== 'string' || !value.trim())
    throw new Error('Invalid reference-alias string.');
  return value;
}
