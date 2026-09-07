import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('WorkPhelo Reinsurance Operations API')
    .setDescription(
      `
Broker-only Reinsurance Operations endpoints owned by \`reinsurance-service\`.

### Routes
- Through the API Gateway: \`/api/v1/operations/reinsurance/*\`
- Direct local service access: \`/api/*\`

### Authentication
Protected requests use the HTTP-only \`access_token\` cookie set by Auth login.
Bearer authentication is also documented for API tooling. Through the gateway,
tenant context and signed dynamic permissions are forwarded to this service.

### Authorization
Counterparty, placement and email endpoints require the tenant to have the \`operations\` module and
\`operations.reinsurance\` feature enabled, plus the endpoint-specific
\`operations.reinsurance.counterparties:*\`, \`operations.reinsurance.settings:*\` or
\`operations.reinsurance.placements:*\`, \`operations.reinsurance.email:*\` or
\`operations.reinsurance.email-settings:*\` permission.

### Risk settings integration
New frontend work should use \`/settings/risk-classes\` for RiskClass CRUD and
\`/settings/risk-types\` for RiskType CRUD, fields and form schemas.

### Slip previews
Offer and closing slip preview endpoints are read-only. They return preview
payloads only and do not create PDFs, persist document records or send email.
Preview calculations intentionally use \`facultativeOffer ?? 0\` when the
facultative offer is not yet known.

### Documents
Document endpoints create registry rows with immutable source snapshots and
backend-rendered PDFs for supported placement and endorsement documents. Private
storage metadata is retained by the service and clients use signed download
URLs. Browser-generated previews are not official documents.

### Placement closings
Placement closing endpoints persist participant-specific closing snapshots for
accepted participants. Closings use the lifecycle \`DRAFT → ISSUED → CONFIRMED\`,
with \`VOID\` available from \`DRAFT\` or \`ISSUED\`. They do not create PDFs,
document registry entries, emails, payments, debit notes or credit notes.

### Debit and credit notes
Debit and credit note endpoints persist financial note records generated from
confirmed closing snapshots. Debit notes are placement-level cedant notes.
Credit notes are per confirmed reinsurer closing. NIC levy and withholding tax
are tenant-configurable charges selected by effective date and currency.
Generated notes snapshot the applied charge configuration and calculated
amounts, so historical notes are not recalculated after settings changes. Note
generation, issuing and voiding do not financially lock a placement; payments
remain the only hard-lock trigger.

### Claims
Claim endpoints record loss events first. They capture occurrence details,
estimated loss and optional final loss amounts. Claim allocations are generated
explicitly from immutable CONFIRMED placement and endorsement closing snapshots
to calculate reinsurer liability. Claim cash calls are generated one per
allocation from those allocation snapshots. Phase 1 claim payable approval is a
claim-level broker confirmation after required reinsurer approvals have been
obtained externally; it is not an allocation-level approval workflow. Claim
recovery approvals are allocation-level Reinsurer receivable recognition records
and remain separate from cash calls and recovery receipts. Recovery receipts and
cedant settlements are modeled operationally, while additional claim accounting
events remain policy-gated unless explicitly activated.

Financial lock status is available on placement detail responses and
\`GET /placements/:id/lock-status\`. Lifecycle edit rules and financial locks
are distinct. Editable placements can be safely reopened to market after direct
updates; downstream financial activity requires endorsements instead. Payments,
claims, active endorsements and terminal lifecycle states block unsafe direct
mutation. Reversal records preserve financial history and do not erase lock
history.

### Endorsements
Endorsement endpoints create versioned placement adjustment records. The backend
captures \`originalSnapshot\` at creation and stores proposed changes separately.
Endorsements do not mutate the original placement, participants, closings,
payments or notes. Endorsement participants and endorsement closings are
endorsement-scoped records for market responses, accepted endorsement business,
force close, close readiness and current effective position calculations.
Declined endorsement participants may be reinvited through the endpoint that
preserves prior invitation history.

### Email foundation
The email endpoints support mailbox readiness, provider metadata,
placement-scoped conversation reads and placement email send/reply persistence.
Claim and cash-call email flows that are still preview-only must remain labeled
as previews until backend send support exists for those flows.

### Accounting integration
Accounting integration uses tenant-scoped source events, deterministic
idempotency keys, transactional outbox rows, automatic dispatcher/retry support,
reconciliation endpoints and signed internal transport. Active Reinsurance
events include issued debit/credit notes, endorsement notes, premium receipts
and reversals, bank-confirmed reinsurer disbursements and reversals, and
claim-level payable approvals plus allocation-level claim recovery approvals.
Policy-gated Claims events must not be described as active until implemented.

Documentation is exposed only when \`ENABLE_SWAGGER=true\`; the deployment
pipeline enables it for development only.
      `,
    )
    .setVersion('1.0')
    .addServer(
      '/api/v1/operations/reinsurance',
      'API Gateway (select when opening docs through the gateway)',
    )
    .addServer('/api', 'Direct reinsurance-service (local development)')
    .addTag(
      'Reinsurance - Health',
      'Development and deployment health verification',
    )
    .addTag(
      'Reinsurance - Access',
      'Authenticated entitlement and permission verification',
    )
    .addTag('Reinsurance - Counterparties', 'Cedants, reinsurers and brokers')
    .addTag(
      'Reinsurance - Placements',
      'High-level facultative placement CRUD, detail, status and archive endpoints',
    )
    .addTag(
      'Reinsurance - Placement Participants',
      'Placement market participant management and participant workflow states',
    )
    .addTag(
      'Reinsurance - Placement Closings',
      'Persisted participant closing snapshots and closing lifecycle endpoints',
    )
    .addTag(
      'Reinsurance - Slip Previews',
      'Read-only offer and closing slip preview endpoints',
    )
    .addTag(
      'Reinsurance - Payments',
      'Placement payment recording, payment history and reversal records',
    )
    .addTag(
      'Reinsurance - Notes',
      'Debit/credit note listing, detail, issue and void lifecycle endpoints',
    )
    .addTag(
      'Reinsurance - Debit Notes',
      'Placement-level cedant debit notes generated from confirmed closings',
    )
    .addTag(
      'Reinsurance - Credit Notes',
      'Reinsurer credit notes generated per confirmed closing',
    )
    .addTag(
      'Reinsurance - Endorsement Notes',
      'Endorsement debit and credit notes generated from confirmed endorsement closing snapshots',
    )
    .addTag(
      'Reinsurance - Claims',
      'Loss-event claim records, lifecycle and final loss updates',
    )
    .addTag(
      'Reinsurance - Claim Allocations',
      'Reinsurer liability calculations generated from immutable closing snapshots',
    )
    .addTag(
      'Reinsurance - Claim Cash Calls',
      'Cash calls generated one-per-claim-allocation from allocation snapshots',
    )
    .addTag(
      'Reinsurance - Claim Recoveries',
      'Claim recovery approvals, recovery position, cash-call receipts and receipt reversal endpoints',
    )
    .addTag(
      'Reinsurance - Documents',
      'Generated document registry entries, immutable snapshots, PDF rendering and private S3 download URLs',
    )
    .addTag(
      'Reinsurance - Financial Locking',
      'Direct-edit lock status used to gate future endorsement-required changes',
    )
    .addTag(
      'Reinsurance - Endorsements',
      'Versioned placement adjustment records created after placement closing; mandatory after payment lock',
    )
    .addTag(
      'Reinsurance - Endorsement Participants',
      'Endorsement-scoped reinsurer market responses and capacity aggregates',
    )
    .addTag(
      'Reinsurance - Endorsement Closings',
      'Endorsement-scoped closing snapshots created from accepted endorsement participants',
    )
    .addTag(
      'Reinsurance - Risk Classes',
      'Risk class settings and nested risk type lists',
    )
    .addTag('Reinsurance - Risk Types', 'Risk type CRUD endpoints')
    .addTag(
      'Reinsurance - Risk Type Fields',
      'Dynamic risk type fields and form schema endpoints',
    )
    .addTag('Reinsurance - Currencies', 'Tenant currency settings')
    .addTag(
      'Reinsurance - Email Mailboxes',
      'Mailbox connectivity, provider verification and metadata sync',
    )
    .addTag(
      'Reinsurance - Email Threads',
      'Thread/message metadata and manual placement email links',
    )
    .addTag(
      'Reinsurance - Placement Emails',
      'Placement-scoped email conversation, send, reply, link and unlink workflows',
    )
    .addCookieAuth('access_token')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        in: 'header',
      },
      'access-token',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    ignoreGlobalPrefix: true,
  });

  SwaggerModule.setup('docs', app, document, {
    useGlobalPrefix: true,
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'method',
      url: 'docs-json',
    },
    customSiteTitle: 'WorkPhelo Reinsurance API Docs',
  });
}
