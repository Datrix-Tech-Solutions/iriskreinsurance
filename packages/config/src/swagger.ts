type SwaggerEnv = Partial<Pick<NodeJS.ProcessEnv, 'DEPLOY_ENV' | 'ENABLE_SWAGGER' | 'NODE_ENV'>>;

const TRUE_VALUES = new Set(['true', '1', 'yes', 'on']);
const FALSE_VALUES = new Set(['false', '0', 'no', 'off']);

export function isSwaggerEnabled(env: SwaggerEnv = process.env): boolean {
  const explicit = env.ENABLE_SWAGGER?.trim().toLowerCase();

  if (explicit && TRUE_VALUES.has(explicit)) {
    return true;
  }

  if (explicit && FALSE_VALUES.has(explicit)) {
    return false;
  }

  if (env.DEPLOY_ENV) {
    return env.DEPLOY_ENV !== 'prod';
  }

  return env.NODE_ENV !== 'production';
}
