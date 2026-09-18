export type TenantStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'PENDING_VERIFICATION';

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  email: string;
  phone?: string;
  country?: string;
  address?: string;
  currency?: string;
  industry?: string;
  size?: string;
  status: TenantStatus;
  createdAt: string;
  moduleConfig?: Record<string, boolean>;
  featureConfig?: Record<string, Record<string, boolean>>;
}

export interface RegisterTenantPayload {
  name: string;
  slug: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  country?: string;
  address?: string;
  currency?: string;
  industry?: string;
  size?: string;
}

// ── Tenant User ──────────────────────────────────────────
export interface TenantUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: 'SUPER_ADMIN' | 'TENANT_ADMIN' | 'EMPLOYEE';
  status: string;
}

// ── Audit Log ────────────────────────────────────────────
export interface AuditLog {
  id: string;
  resource: string;
  resourceId?: string;
  action: string;
  userId?: string;
  userEmail?: string;
  userRole?: string;
  changes?: { before?: Record<string, unknown>; after?: Record<string, unknown> };
  ipAddress?: string;
  userAgent?: string;
  status?: 'SUCCESS' | 'FAILURE';
  failureReason?: string;
  createdAt: string;
}

export interface AuditMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AuditData {
  logs: AuditLog[];
  meta: AuditMeta;
}

// ── Company (SuperAdmin table display model) ─────────────
export interface Company {
  id: string;
  name: string;
  email: string;
  dateCreated: string;
  contact: string;
  industry: string;
  status: TenantStatus;
}
