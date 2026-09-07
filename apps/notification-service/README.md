# WorkPhelo Notification Service

The notification-service owns outbound notification delivery for WorkPhelo. It handles email, SMS, in-app notification support, delivery logging, and provider integrations behind RabbitMQ events published by platform services.

Current environment URLs are listed in the root repository README.

## Gateway Prefix

```text
/api/v1/notification/*
```

## Local Development

```bash
npm run dev --workspace=apps/notification-service
```

Default local port: `4004`

Local Swagger: `http://localhost:4004/api/docs`

## SMS Providers

SMS delivery is routed through the public `SmsService` API:

```ts
sendMessage(to, message);
sendOtp(to, otp, context);
```

The implementation uses a provider abstraction so callers do not depend on a vendor directly. Configure the active provider with:

```env
SMS_PROVIDER=termii
```

Supported values:

- `termii`
- `pilosms`

If `SMS_PROVIDER` is omitted, the service defaults to `termii` for backward compatibility.

## Environment

Common notification-service variables:

```env
DATABASE_URL=
RABBITMQ_URL=
JWT_SECRET=
FRONTEND_BASE_URL=
RESEND_API_KEY=
RESEND_FROM_EMAIL=
```

Termii provider:

```env
SMS_PROVIDER=termii
TERMII_API_KEY=
TERMII_SENDER_ID=WorkPhelo
```

PiloSMS provider:

```env
SMS_PROVIDER=pilosms
PILOSMS_API_KEY=
PILOSMS_SENDER_ID=WorkPhelo
```

Runtime validation requires the API key and sender ID only for the selected SMS provider. Unsupported provider values fail fast during startup.

Development deployment wiring can map GitHub environment values into the runtime
names above:

```env
NOTIFY_SMS_PROVIDER=pilosms
NOTIFY_PILOSMS_API_KEY=
NOTIFY_PILOSMS_SENDER_ID=WorkPhelo
```

The deploy script writes `SMS_PROVIDER`, `PILOSMS_API_KEY`, and
`PILOSMS_SENDER_ID` into the notification-service runtime env file when those
values are configured. Production activation should be treated as an explicit
environment/secrets rollout.

## PiloSMS Notes

PiloSMS expects recipients in international format without the leading plus sign. WorkPhelo keeps internal phone numbers in E.164 format, for example `+233244000001`, and the PiloSMS adapter converts that value to `233244000001` at the provider boundary.

The PiloSMS adapter intentionally rejects local numbers such as `0244000001`; it does not infer country codes.

PiloSMS response mapping:

- `1001`: `SENT`
- `1002`: `FAILED`
- `1003`: `FAILED`
- `1004`: `FAILED`
- `1005`: `FAILED`
- `1006`: `SKIPPED`
- `1007`: `FAILED`

Provider status/detail metadata is stored in `NotificationLog.metadata` for SMS deliveries.

## Announcement SMS Format

HR announcement SMS messages are intentionally short to reduce multi-segment SMS costs. The notification-service formats announcement SMS with the tenant/company name, title, and a body preview:

```text
{CompanyName}: {AnnouncementTitle} - {AnnouncementPreview}
```

Example:

```text
Acme: Test Announcement - First announcement test.
```

The SMS formatter removes URLs and workspace links from SMS content. Email templates may still include workspace links, but SMS messages must not include internal URLs, tenant IDs, workspace identifiers, or `View in WorkPhelo` copy.

The formatter targets a single SMS segment by default:

- Maximum length: `160` characters
- Company name and title are preserved whenever possible
- Long body previews are truncated and suffixed with `...`

Before:

```text
WorkPhelo announcement: Test Announcement. Acme First Announcement test from WorkPhelo ERP

View in WorkPhelo: https://app.workphelo.com/acme/login
```

After:

```text
Acme: Test Announcement - First Announcement test from WorkPhelo ERP
```

## Validation

Useful local checks:

```bash
npm run lint --workspace=apps/notification-service
npm run check-types --workspace=apps/notification-service
npm run test --workspace=apps/notification-service
npm run build --workspace=apps/notification-service
```
