import { readFileSync } from 'node:fs';

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

function extractEnumMembers(source, enumName) {
  const match = source.match(
    new RegExp(`export\\s+enum\\s+${enumName}\\s*\\{([\\s\\S]*?)\\n\\}`, 'm'),
  );
  if (!match) {
    throw new Error(`Could not find enum ${enumName}`);
  }

  return new Set(
    Array.from(match[1].matchAll(/^\s*([A-Z0-9_]+)\s*=/gm), ([, key]) => key),
  );
}

function extractNamedResources(source) {
  return new Set(Array.from(source.matchAll(/name:\s*'([^']+)'/g), ([, name]) => name));
}

function extractRuleResources(source) {
  return new Set(
    Array.from(source.matchAll(/'([a-z.-]+):[A-Z]+'/g), ([, resource]) => resource),
  );
}

function extractFeatureMappingResources(source) {
  return new Set(
    Array.from(source.matchAll(/resource:\s*'([^']+)'/g), ([, resource]) => resource),
  );
}

function extractVisibleResources(source) {
  const match = source.match(/PERMISSION_UI_VISIBLE_RESOURCES\s*=\s*new Set\(\[([\s\S]*?)\]\)/m);
  if (!match) {
    throw new Error('Could not find PERMISSION_UI_VISIBLE_RESOURCES');
  }

  return new Set(Array.from(match[1].matchAll(/'([^']+)'/g), ([, name]) => name));
}

function diff(expected, actual) {
  return [...expected].filter((value) => !actual.has(value)).sort();
}

function assertEmpty(values, label) {
  if (values.length === 0) return;
  throw new Error(`${label}: ${values.join(', ')}`);
}

const backendPermissions = extractEnumMembers(
  read('packages/config/src/permissions.ts'),
  'Permission',
);
const frontendPermissions = extractEnumMembers(
  read('apps/web/work-phelo-web/src/lib/permissionMap.ts'),
  'Permission',
);
const runtimeResources = extractNamedResources(
  read('apps/auth-service/src/permissions/resource-definitions.ts'),
);
const seededResources = extractNamedResources(read('apps/auth-service/prisma/seed-resources.ts'));
const permissionMapResources = extractRuleResources(
  read('apps/web/work-phelo-web/src/lib/permissionMap.ts'),
);
const featureMappingResources = extractFeatureMappingResources(
  read('apps/web/work-phelo-web/src/lib/permissionMap.ts'),
);
const visibleResources = extractVisibleResources(
  read('apps/web/work-phelo-web/src/lib/permissionMap.ts'),
);

assertEmpty(
  diff(backendPermissions, frontendPermissions),
  'Frontend Permission enum is missing backend permissions',
);
assertEmpty(
  diff(frontendPermissions, backendPermissions),
  'Frontend Permission enum has extra permissions not present in backend config',
);
assertEmpty(
  diff(runtimeResources, seededResources),
  'Seeded resource list is missing runtime resources',
);
assertEmpty(
  diff(seededResources, runtimeResources),
  'Seeded resource list has resources not present in runtime definitions',
);
assertEmpty(
  diff(permissionMapResources, runtimeResources),
  'Frontend permission map references unknown backend resources',
);
assertEmpty(
  diff(featureMappingResources, runtimeResources),
  'Frontend feature permission mapping references unknown backend resources',
);
assertEmpty(
  diff(visibleResources, runtimeResources),
  'Frontend visible permission resources include unknown backend resources',
);

console.log('RBAC alignment checks passed');
