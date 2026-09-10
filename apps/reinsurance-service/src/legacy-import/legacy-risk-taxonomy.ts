import { sha256 } from './legacy-hash';

export type LegacyRiskClassMapping = {
  key: string;
  name: string;
};

type LegacyRiskClassMappingCollision = {
  normalizedKey: string;
  rawKeys: string[];
};

const LEGACY_RISK_TYPE_TO_RISK_CLASS_RAW: Record<
  string,
  LegacyRiskClassMapping
> = {
  'advance payment bond': { key: 'bond', name: 'Bond' },
  'advanced mobilization bond': { key: 'bond', name: 'Bond' },
  'assets all-risk': { key: 'property', name: 'Property' },
  'assets all-risk & business interruption': {
    key: 'property',
    name: 'Property',
  },
  'automobile liability': { key: 'motor', name: 'Motor' },
  'aviation hull and liability': { key: 'aviation', name: 'Aviation' },
  "banker's indemnity": { key: 'financial-lines', name: 'Financial Lines' },
  'bankers blanket bond': { key: 'financial-lines', name: 'Financial Lines' },
  'bid bond': { key: 'bond', name: 'Bond' },
  'boilers and pressure vessel': { key: 'engineering', name: 'Engineering' },
  'burglary liability': { key: 'property', name: 'Property' },
  'cash-in-transit': { key: 'property', name: 'Property' },
  'clinical trials liability': { key: 'liability', name: 'Liability' },
  'combined fire & burglary': { key: 'property', name: 'Property' },
  'combined insurance': { key: 'property', name: 'Property' },
  'comprehensive machinery insurance': {
    key: 'engineering',
    name: 'Engineering',
  },
  'construction and erection all risk': {
    key: 'engineering',
    name: 'Engineering',
  },
  'contractors all-risk': { key: 'engineering', name: 'Engineering' },
  'contractors plant and machinery': {
    key: 'engineering',
    name: 'Engineering',
  },
  'counter advance mobilization bond': { key: 'bond', name: 'Bond' },
  'counter guarantee bond': { key: 'bond', name: 'Bond' },
  'counter guarantee-bid bond': { key: 'bond', name: 'Bond' },
  'counter performance bond': { key: 'bond', name: 'Bond' },
  'credit guarantee': { key: 'financial-lines', name: 'Financial Lines' },
  'custom agent bond': { key: 'bond', name: 'Bond' },
  'custom premises bond': { key: 'bond', name: 'Bond' },
  'customs division bond': { key: 'bond', name: 'Bond' },
  'customs transit bond': { key: 'bond', name: 'Bond' },
  'cyber insurance': { key: 'financial-lines', name: 'Financial Lines' },
  'directors and officers liability': { key: 'liability', name: 'Liability' },
  'electonic and computer crimes': {
    key: 'financial-lines',
    name: 'Financial Lines',
  },
  'electronic equipment': { key: 'engineering', name: 'Engineering' },
  'electronic equipment insurance': {
    key: 'engineering',
    name: 'Engineering',
  },
  'employers liability': { key: 'liability', name: 'Liability' },
  'erection all-risk': { key: 'engineering', name: 'Engineering' },
  'event insurance': { key: 'liability', name: 'Liability' },
  'exportation bond': { key: 'bond', name: 'Bond' },
  'fidelity guarantee': { key: 'financial-lines', name: 'Financial Lines' },
  'fire and allied perils': { key: 'property', name: 'Property' },
  'general liability': { key: 'liability', name: 'Liability' },
  'general premise bond': { key: 'bond', name: 'Bond' },
  'goods in-transit': { key: 'marine', name: 'Marine' },
  'group personal accident': {
    key: 'accident-and-health',
    name: 'Accident and Health',
  },
  'inland marine cargo': { key: 'marine', name: 'Marine' },
  'land reclamation bond': { key: 'bond', name: 'Bond' },
  'life assurance-mortgage protection': { key: 'life', name: 'Life' },
  'life insurance - key man policy': { key: 'life', name: 'Life' },
  'machinery breakdown & business interruption': {
    key: 'engineering',
    name: 'Engineering',
  },
  'marine  inland transit': { key: 'marine', name: 'Marine' },
  'marine air cargo': { key: 'marine', name: 'Marine' },
  'marine cargo - open cover': { key: 'marine', name: 'Marine' },
  'marine commercial cargo': { key: 'marine', name: 'Marine' },
  'marine hull': { key: 'marine', name: 'Marine' },
  'money insurance': { key: 'property', name: 'Property' },
  'mot0r-umbrella cover for third party': { key: 'motor', name: 'Motor' },
  motor: { key: 'motor', name: 'Motor' },
  'motor comprehensive': { key: 'motor', name: 'Motor' },
  'motor third party liability': { key: 'motor', name: 'Motor' },
  marine: { key: 'marine', name: 'Marine' },
  'performance bond': { key: 'bond', name: 'Bond' },
  'plant & machinery all risk': { key: 'engineering', name: 'Engineering' },
  'political violence & terrorism': {
    key: 'political-violence',
    name: 'Political Violence',
  },
  'poltical violence & terrorism / business interruption': {
    key: 'political-violence',
    name: 'Political Violence',
  },
  'product liability': { key: 'liability', name: 'Liability' },
  'professional indemnity': { key: 'liability', name: 'Liability' },
  'property all risks': { key: 'property', name: 'Property' },
  'protection and indemnity (p&i) insurance': {
    key: 'marine',
    name: 'Marine',
  },
  'public and product liability': { key: 'liability', name: 'Liability' },
  'public liability': { key: 'liability', name: 'Liability' },
  'railway hull/locomotive insurance': {
    key: 'engineering',
    name: 'Engineering',
  },
  're-exportation bond': { key: 'bond', name: 'Bond' },
  'removal bond': { key: 'bond', name: 'Bond' },
  'retention bond': { key: 'bond', name: 'Bond' },
  'rolling stock hull insurance and associated liabilities': {
    key: 'engineering',
    name: 'Engineering',
  },
  'supply bond': { key: 'bond', name: 'Bond' },
  'temporary importation/exportation bond': { key: 'bond', name: 'Bond' },
  'third party liability': { key: 'liability', name: 'Liability' },
  'third party,fire and theft': { key: 'motor', name: 'Motor' },
  'transshipment bond': { key: 'bond', name: 'Bond' },
  'umbrella cover': { key: 'motor', name: 'Motor' },
  'unconditional advance payment bond': { key: 'bond', name: 'Bond' },
  'warehouse bond': { key: 'bond', name: 'Bond' },
  'warehouse security bond': { key: 'bond', name: 'Bond' },
  "workmen's compensation": {
    key: 'accident-and-health',
    name: 'Accident and Health',
  },
};

const LEGACY_RISK_TYPE_TO_RISK_CLASS = buildNormalizedRiskClassMap(
  LEGACY_RISK_TYPE_TO_RISK_CLASS_RAW,
);

export function resolveLegacyRiskClass(
  legacyRiskTypeName: string,
): LegacyRiskClassMapping | null {
  const normalizedKey = normalizeLegacyRiskTypeName(legacyRiskTypeName);
  return LEGACY_RISK_TYPE_TO_RISK_CLASS[normalizedKey] ?? null;
}

export function getLegacyRiskTaxonomyMappingCollisions(): LegacyRiskClassMappingCollision[] {
  return findMappingKeyNormalizationCollisions(
    LEGACY_RISK_TYPE_TO_RISK_CLASS_RAW,
  );
}

export function legacyRiskClassLegacyId(mapping: LegacyRiskClassMapping) {
  return mapping.key;
}

export function riskClassDefinitionHash(mapping: LegacyRiskClassMapping) {
  return sha256({ key: mapping.key, name: mapping.name });
}

export function riskTypeDefinitionHash(input: {
  legacyClassId: string;
  riskTypeName: string;
  riskClass: LegacyRiskClassMapping;
}) {
  return sha256({
    legacyClassId: input.legacyClassId,
    riskTypeName: input.riskTypeName,
    riskClassKey: input.riskClass.key,
    riskClassName: input.riskClass.name,
  });
}

export function legacyRiskTypeCanonicalKey(input: {
  riskClass: LegacyRiskClassMapping;
  riskTypeName: string;
}) {
  return `${legacyRiskClassLegacyId(input.riskClass)}:${normalizeLegacyRiskTypeName(input.riskTypeName)}`;
}

export function legacyRiskTypeFieldCanonicalKey(input: {
  riskClass: LegacyRiskClassMapping;
  riskTypeName: string;
  normalizedFieldKey: string;
}) {
  return `${legacyRiskTypeCanonicalKey(input)}:${input.normalizedFieldKey}`;
}

export function normalizeLegacyRiskTypeName(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function buildNormalizedRiskClassMap(
  rawMappings: Record<string, LegacyRiskClassMapping>,
) {
  const collisions = findMappingKeyNormalizationCollisions(rawMappings);
  if (collisions.length > 0) {
    const details = collisions
      .map(
        (collision) =>
          `${collision.normalizedKey}: ${collision.rawKeys.join(', ')}`,
      )
      .join('; ');
    throw new Error(
      `Legacy risk taxonomy mapping keys collide after normalization: ${details}`,
    );
  }

  return Object.fromEntries(
    Object.entries(rawMappings).map(([riskTypeName, riskClass]) => [
      normalizeLegacyRiskTypeName(riskTypeName),
      riskClass,
    ]),
  );
}

function findMappingKeyNormalizationCollisions(
  rawMappings: Record<string, LegacyRiskClassMapping>,
): LegacyRiskClassMappingCollision[] {
  const rawKeysByNormalizedKey = new Map<string, string[]>();
  for (const rawKey of Object.keys(rawMappings)) {
    const normalizedKey = normalizeLegacyRiskTypeName(rawKey);
    const rawKeys = rawKeysByNormalizedKey.get(normalizedKey) ?? [];
    rawKeys.push(rawKey);
    rawKeysByNormalizedKey.set(normalizedKey, rawKeys);
  }

  return [...rawKeysByNormalizedKey.entries()]
    .filter(([, rawKeys]) => rawKeys.length > 1)
    .map(([normalizedKey, rawKeys]) => ({ normalizedKey, rawKeys }));
}
