import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Request } from 'express';

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('WorkPhelo Accounting API')
    .setDescription(
      `
Tenant-scoped Accounting ledger foundation.

### Routes
- API Gateway: \`/api/v1/accounting/*\`
- Direct local service: \`/api/*\`

### Ledger guarantees
- Draft journals must be balanced before creation and posting.
- Only open fiscal periods accept postings.
- Posted journals and lines are immutable.
- Corrections create exact linked reversal journals.
- Transaction and base-currency amounts are stored on every journal line.
- Source idempotency keys are tenant-scoped for future operational integrations.
- Cash, bank and wallet account masters are Accounting-owned and link to active,
  posting-enabled GL asset accounts.
- Cashbook entries are draft until posted; posting creates balanced journals and
  corrections use linked reversals.
- Standalone Accounts Receivable uses tenant AR control configuration, customer
  subledgers and cashbook-backed receipts. Allocations update AR application
  state only and never create duplicate cash journals.
- Standalone Accounts Payable uses tenant AP control configuration, vendor
  subledgers and cashbook-backed payments. Allocations update AP application
  state only and never create duplicate cash journals.
- Counterparty subledger balances are scoped by GL control account. The same
  legal Cedant/Reinsurer can hold separate premium receivable, claims payable,
  premium payable and claims receivable dimensions without unintended netting.
- Cash-impact source-module events use Cashbook as the authoritative bank/cash
  posting path: Accounting validates the source-provided cashAccountId, uses the
  Accounting cash account GL for the cash leg, preserves the posting-rule counter
  leg, and links SourceEventInbox, CashbookTransaction and JournalEntry.
- INTERNAL_OFFSET and JOURNAL source settlements are non-cash and do not create
  Cashbook cash movements.

Operational source-event posting is active through the Accounting Source Event
Inbox and tenant posting rules. Source modules publish business facts only;
Accounting validates fiscal periods, idempotency, posting rules, subledgers and
balanced journal creation. Financial confirmation queues are optional adapters
for operational modules such as Reinsurance, while manual Accounting workflows
remain independently usable.
      `,
    )
    .setVersion('1.0')
    .addCookieAuth('access_token', undefined, 'access_token')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token',
    )
    .addTag('Accounting - Health')
    .addTag('Accounting - Configuration')
    .addTag('Accounting - Currencies')
    .addTag('Accounting - Fiscal Periods')
    .addTag('Accounting - Chart of Accounts')
    .addTag('Accounting - Cost Centres')
    .addTag('Accounting - Subledgers')
    .addTag('Accounting - Cash Accounts')
    .addTag('Accounting - Cashbook')
    .addTag('Accounting - Receivables')
    .addTag('Accounting - Payables')
    .addTag('Accounting - Journals')
    .addTag('Accounting - General Ledger')
    .addTag('Accounting - Financial Reports')
    .addTag('Accounting - Posting Rules')
    .addTag('Accounting - Source Events')
    .addTag(
      'Accounting - Financial Confirmations',
      'Accounting-owned bank confirmation queues for optional source-module integrations',
    )
    .addTag('Internal Accounting Source Events')
    .build();

  // Paths remain relative to the selected server. This prevents Swagger from
  // generating `/api/v1/accounting/api/...` when its document is proxied by
  // the Gateway.
  const document = SwaggerModule.createDocument(app, config, {
    ignoreGlobalPrefix: true,
  });
  SwaggerModule.setup('docs', app, document, {
    useGlobalPrefix: true,
    jsonDocumentUrl: 'docs-json',
    yamlDocumentUrl: 'docs-yaml',
    swaggerOptions: {
      persistAuthorization: true,
    },
    patchDocumentOnRequest: (request, _response, baseDocument) => {
      const swaggerRequest = request as Request;
      const isGatewayRequest =
        swaggerRequest.headers['x-workphelo-gateway-docs'] === 'accounting';
      const forwardedProto = swaggerRequest.headers['x-forwarded-proto'];
      const protocol = Array.isArray(forwardedProto)
        ? forwardedProto[0]
        : (forwardedProto ?? swaggerRequest.protocol);
      const forwardedHost = swaggerRequest.headers['x-forwarded-host'];
      const host = isGatewayRequest
        ? Array.isArray(forwardedHost)
          ? forwardedHost[0]
          : forwardedHost
        : swaggerRequest.headers.host;

      return {
        ...baseDocument,
        servers: host
          ? [
              {
                url: `${protocol}://${host}${
                  isGatewayRequest ? '/api/v1/accounting' : '/api'
                }`,
                description: isGatewayRequest
                  ? 'API Gateway'
                  : 'Direct accounting-service',
              },
            ]
          : baseDocument.servers,
      };
    },
  });
}
