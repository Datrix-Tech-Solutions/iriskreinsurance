export type FinancialEventPayload = Record<string, unknown>;

export interface FinancialSourceEventInput<
  TPayload extends FinancialEventPayload = FinancialEventPayload,
> {
  tenantId: string;
  sourceEventType: string;
  sourceRecordId: string;
  sourceDocumentId?: string | null;
  idempotencyKey: string;
  occurredAt: Date | string;
  currency: string;
  payload: TPayload;
}

export interface FinancialSourceEventEnvelope<
  TSourceModule extends string = string,
  TPayload extends FinancialEventPayload = FinancialEventPayload,
> {
  tenantId: string;
  sourceModule: TSourceModule;
  sourceEventType: string;
  sourceRecordId: string;
  sourceDocumentId?: string;
  idempotencyKey: string;
  occurredAt: string;
  currency: string;
  payload: TPayload;
}

export interface FinancialEventPublisher<
  TPreparedEvent extends FinancialSourceEventInput = FinancialSourceEventInput,
  TPublishResult = unknown,
> {
  publish(event: TPreparedEvent): Promise<TPublishResult>;
}
