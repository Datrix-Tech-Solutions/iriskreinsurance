import { PrismaService } from '../../src/prisma/prisma.service';

export async function resetCurrentSchema(prisma: PrismaService) {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "w_auth"."AuditLog",
      "w_auth"."TenantBankAccount",
      "w_auth"."TenantDocumentProfile",
      "w_auth"."TenantBranding",
      "w_auth"."UserPermissionSet",
      "w_auth"."PermissionSetResource",
      "w_auth"."PermissionSet",
      "w_auth"."UserPermission",
      "w_auth"."Resource",
      "w_auth"."SocialAccount",
      "w_auth"."OtpCode",
      "w_auth"."RefreshToken",
      "w_auth"."User",
      "w_auth"."Tenant"
    RESTART IDENTITY CASCADE
  `);
}
