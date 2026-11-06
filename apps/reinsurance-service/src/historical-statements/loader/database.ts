import { Client, QueryResultRow } from 'pg';
import { object, text } from './source-contract';
export const ARCHIVE_TABLES = [
  'historical_statement_load',
  'historical_statement_file',
  'historical_insurer_statement',
  'historical_reinsurer_statement',
  'historical_statement_link',
] as const;
export type ArchiveTable = (typeof ARCHIVE_TABLES)[number];
export interface DatabaseIdentity {
  environment: 'local' | 'dev';
  host: string;
  port: number;
  database: string;
  schema: 'reinsurance';
  role: string;
  readRole: string;
  purpose: 'ARCHIVE' | 'DISPOSABLE_TEST';
}
export interface Actor {
  tenantId: string;
  tenantSlug: string;
  userId: string;
  allowUnentitledLocalTest?: boolean;
}
export function parseIdentity(v: unknown): DatabaseIdentity {
  const i = object(v, 'database identity');
  if (
    (i.environment !== 'local' && i.environment !== 'dev') ||
    i.schema !== 'reinsurance' ||
    (i.purpose !== 'ARCHIVE' && i.purpose !== 'DISPOSABLE_TEST') ||
    typeof i.port !== 'number' ||
    !Number.isInteger(i.port) ||
    i.port < 1 ||
    i.port > 65535
  )
    throw new Error('Invalid reviewed database identity');
  return {
    environment: i.environment,
    host: text(i.host, 'database host'),
    port: i.port,
    database: text(i.database, 'database name'),
    schema: 'reinsurance',
    role: text(i.role, 'database role'),
    readRole: text(i.readRole, 'read-only role'),
    purpose: i.purpose,
  };
}
export class ArchiveDatabase {
  private client: Client;
  constructor(
    url: string,
    readonly identity: DatabaseIdentity,
    readonly mode: 'read' | 'write' = 'read',
  ) {
    const u = new URL(url);
    if (
      !['postgres:', 'postgresql:'].includes(u.protocol) ||
      u.hostname !== identity.host ||
      Number(u.port || 5432) !== identity.port ||
      decodeURIComponent(u.pathname.slice(1)) !== identity.database ||
      decodeURIComponent(u.username) !==
        (mode === 'write' ? identity.role : identity.readRole) ||
      u.hash ||
      [...u.searchParams.keys()].some((k) => k !== 'schema') ||
      (u.searchParams.has('schema') &&
        u.searchParams.get('schema') !== 'reinsurance')
    )
      throw new Error('Database URL does not match reviewed identity');
    if (
      identity.environment === 'local' &&
      !['127.0.0.1', 'localhost'].includes(u.hostname)
    )
      throw new Error('Local database must be loopback');
    if (
      identity.purpose === 'DISPOSABLE_TEST' &&
      (identity.environment !== 'local' ||
        !identity.database.startsWith('irisk_archive_m2a_'))
    )
      throw new Error('Invalid disposable database scope');
    this.client = new Client({
      host: u.hostname,
      port: identity.port,
      database: identity.database,
      user: mode === 'write' ? identity.role : identity.readRole,
      password: decodeURIComponent(u.password),
      ssl:
        identity.environment === 'dev' ? { rejectUnauthorized: true } : false,
      connectionTimeoutMillis: 5000,
      application_name: 'historical-statements-offline-loader',
      options: '-c statement_timeout=60000 -c lock_timeout=5000',
    });
  }
  async connect() {
    await this.client.connect();
    const r = await this.query<{
      database: string;
      role: string;
      schema: string;
    }>(
      'SELECT current_database() AS database,current_user AS role,current_schema() AS schema',
    );
    if (
      r[0].database !== this.identity.database ||
      r[0].role !==
        (this.mode === 'write' ? this.identity.role : this.identity.readRole)
    )
      throw new Error('Connected database identity mismatch');
  }
  async close() {
    await this.client.end();
  }
  async query<T extends QueryResultRow = Record<string, unknown>>(
    sql: string,
    values: unknown[] = [],
  ): Promise<T[]> {
    return (await this.client.query<T>(sql, values)).rows;
  }
  async transaction<T>(readOnly: boolean, fn: () => Promise<T>): Promise<T> {
    await this.query(
      `BEGIN ISOLATION LEVEL SERIALIZABLE ${readOnly ? 'READ ONLY' : 'READ WRITE'}`,
    );
    try {
      const result = await fn();
      await this.query('COMMIT');
      return result;
    } catch (e) {
      await this.query('ROLLBACK');
      throw e;
    }
  }
  async verifyPrivileges(write: boolean) {
    const [role] = await this.query<{ unsafe: boolean }>(
      `SELECT (rolsuper OR rolcreaterole OR rolcreatedb OR rolbypassrls) AS unsafe FROM pg_roles WHERE rolname=current_user`,
    );
    if (!role || role.unsafe)
      throw new Error(
        'Archive command requires a nonprivileged dedicated database role',
      );
    const dangerous = await this.query<{ name: string }>(
      `SELECT c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('reinsurance','w_auth') AND c.relkind IN ('r','p') AND NOT (n.nspname='reinsurance' AND c.relname=ANY($1::text[])) AND (has_table_privilege(current_user,c.oid,'INSERT,UPDATE,DELETE,TRUNCATE') OR has_any_column_privilege(current_user,c.oid,'INSERT,UPDATE'))`,
      [ARCHIVE_TABLES],
    );
    if (dangerous.length)
      throw new Error('Database role can modify non-archive tables');
    for (const table of ARCHIVE_TABLES) {
      const [r] = await this.query<{
        read: boolean;
        write: boolean;
        insert: boolean;
        update: boolean;
        delete: boolean;
        owner: boolean;
        truncate: boolean;
      }>(
        `SELECT has_table_privilege(current_user,c.oid,'SELECT') AS read,(has_table_privilege(current_user,c.oid,'INSERT,UPDATE,DELETE') OR has_any_column_privilege(current_user,c.oid,'INSERT,UPDATE')) AS write,has_table_privilege(current_user,c.oid,'INSERT') AS insert,has_table_privilege(current_user,c.oid,'UPDATE') AS update,has_table_privilege(current_user,c.oid,'DELETE') AS delete,pg_has_role(current_user,c.relowner,'MEMBER') AS owner,has_table_privilege(current_user,c.oid,'TRUNCATE') AS truncate FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='reinsurance' AND c.relname=$1`,
        [table],
      );
      if (
        !r ||
        !r.read ||
        r.owner ||
        r.truncate ||
        (!write && r.write) ||
        (write &&
          (!r.insert ||
            (table === 'historical_statement_load'
              ? !r.update || r.delete
              : !r.delete || r.update)))
      )
        throw new Error('Incorrect archive runtime/loader privileges');
    }
    const [schemas] = await this.query<{ unsafe: boolean }>(
      `SELECT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname NOT LIKE 'pg_%' AND has_schema_privilege(current_user,oid,'CREATE')) OR has_database_privilege(current_user,current_database(),'CREATE') AS unsafe`,
    );
    if (schemas.unsafe)
      throw new Error('Archive role must not own/create database schemas');
  }
  async verifyActor(actor: Actor) {
    const rows = await this.query<{ enabled: boolean; role: string }>(
      `SELECT t."historicalStatementsEnabled" AS enabled,u.role::text AS role FROM w_auth."Tenant" t JOIN w_auth."User" u ON u."tenantId"=t.id WHERE t.id=$1 AND t.slug=$2 AND t.status::text='ACTIVE' AND u.id=$3 AND u.status::text='ACTIVE' AND t."moduleConfig"->'operations'='true'::jsonb AND t."featureConfig"->'operations'->'reinsurance'='true'::jsonb`,
      [actor.tenantId, actor.tenantSlug, actor.userId],
    );
    if (
      rows.length !== 1 ||
      !['TENANT_ADMIN', 'SUPER_ADMIN'].includes(rows[0].role)
    )
      throw new Error(
        'Import actor must be an active administrator of the exact active tenant',
      );
    const disposable =
      actor.allowUnentitledLocalTest &&
      this.identity.purpose === 'DISPOSABLE_TEST' &&
      this.identity.environment === 'local';
    if (!rows[0].enabled && !disposable)
      throw new Error('Platform archive entitlement is disabled');
  }
  async locked<T>(
    tenantId: string,
    key: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    const params = [`${tenantId}:${key}`];
    const [r] = await this.query<{ locked: boolean }>(
      'SELECT pg_try_advisory_lock(hashtextextended($1,0)) AS locked',
      params,
    );
    if (!r.locked)
      throw new Error('Archive dataset is locked by another loader');
    try {
      return await fn();
    } finally {
      await this.query(
        'SELECT pg_advisory_unlock(hashtextextended($1,0))',
        params,
      );
    }
  }
  async insert(table: ArchiveTable, rows: Record<string, unknown>[]) {
    if (!rows.length) return;
    if (!ARCHIVE_TABLES.includes(table))
      throw new Error('Non-archive write forbidden');
    await this.query(
      `INSERT INTO reinsurance."${table}" SELECT * FROM jsonb_populate_recordset(NULL::reinsurance."${table}",$1::jsonb)`,
      [JSON.stringify(rows)],
    );
  }
}
