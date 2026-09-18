export type AccountType = 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense';
export type AccountStatus = 'Active' | 'Inactive';

export interface ChartOfAccount {
  id: string;
  accountCode: string;
  accountName: string;
  type: AccountType;
  parentAccount: string | null;
  currency: string;
  status: AccountStatus;
  description: string | null;
}

export type GLAccountCategory = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
export type NormalBalance = 'DEBIT' | 'CREDIT';
export type GLAccountStatus = 'ACTIVE' | 'INACTIVE';

export interface GLAccount {
  id: string;
  code: string;
  name: string;
  category: GLAccountCategory;
  normalBalance: NormalBalance;
  accountGroupId: string | null;
  accountGroup: { id: string; code: string; name: string } | null;
  parentAccountId: string | null;
  parentAccount: { id: string; code: string; name: string } | null;
  allowPosting: boolean;
  description: string | null;
  status: GLAccountStatus;
}

export interface CreateGLAccountPayload {
  code: string;
  name: string;
  category?: GLAccountCategory;
  normalBalance?: NormalBalance;
  accountGroupId?: string;
  parentAccountId?: string;
  allowPosting?: boolean;
  description?: string;
}

export type UpdateGLAccountPayload = Partial<CreateGLAccountPayload>;

export interface GLAccountLedgerEntry {
  id: string;
  description: string | null;
  baseDebit: string;
  baseCredit: string;
  runningBalance: string;
  subledgerAccount: { id: string; code: string; name: string } | null;
  journalEntry: {
    journalNumber: string;
    transactionDate: string;
    reference: string | null;
    description: string;
    baseCurrency: string;
  };
}

export interface GLAccountLedger {
  entries: GLAccountLedgerEntry[];
  closingBalance: string;
}

export interface FinancialReportAccount {
  id: string;
  code: string;
  name: string;
  category: GLAccountCategory;
  normalBalance?: NormalBalance;
  classification: { id: string | null; code: string; name: string; category: GLAccountCategory };
  accountGroup: { id: string | null; code: string; name: string };
}

export interface GeneralLedgerReport {
  openingBalance: string;
  totalDebit: string;
  totalCredit: string;
  closingBalance: string;
  lines: Array<{
    id: string;
    journalDate: string;
    postingDate: string | null;
    journalNumber: string;
    journalStatus: JournalRecordStatus;
    description: string | null;
    account: FinancialReportAccount;
    debit: string;
    credit: string;
    runningBalance: string;
    transactionCurrency: string;
  }>;
}

export interface TrialBalanceReport {
  asOfDate: string;
  accounts: Record<
    GLAccountCategory,
    Array<{
      account: FinancialReportAccount;
      debitBalance: string;
      creditBalance: string;
    }>
  >;
  totalDebit: string;
  totalCredit: string;
  imbalanceAmount: string;
}

export interface IncomeStatementReport {
  fromDate: string;
  toDate: string;
  revenueAccounts: Array<{ account: FinancialReportAccount; amount: string }>;
  expenseAccounts: Array<{ account: FinancialReportAccount; amount: string }>;
  totalRevenue: string;
  totalExpenses: string;
  netProfitOrLoss: string;
}

export interface BalanceSheetReport {
  asOfDate: string;
  assets: Array<{ account: FinancialReportAccount; amount: string }>;
  liabilities: Array<{ account: FinancialReportAccount; amount: string }>;
  equity: Array<{ account: FinancialReportAccount; amount: string }>;
  totalAssets: string;
  totalLiabilities: string;
  totalEquity: string;
  imbalanceAmount: string;
}

export interface QueryGLAccountsParams {
  category?: GLAccountCategory;
  status?: GLAccountStatus;
}

export type CostCentreStatus = 'ACTIVE' | 'INACTIVE';

export interface CostCentre {
  id: string;
  code: string;
  name: string;
  description: string | null;
  externalRef: string | null;
  status: CostCentreStatus;
}

export interface CreateCostCentrePayload {
  code: string;
  name: string;
  description?: string;
  externalRef?: string;
}

export type UpdateCostCentrePayload = Partial<CreateCostCentrePayload>;

export type FiscalPeriodStatus = 'OPEN' | 'CLOSED' | 'LOCKED';

export interface FiscalPeriod {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: FiscalPeriodStatus;
}

export interface CreateFiscalPeriodPayload {
  name: string;
  startDate: string;
  endDate: string;
}

export interface QueryFiscalPeriodsParams {
  status?: FiscalPeriodStatus;
}

export interface AccountTypeDefinition {
  id: string;
  name: string;
  description: string | null;
}

export interface AccountCategoryDefinition {
  code: GLAccountCategory;
  name: string;
  normalBalance: NormalBalance;
  financialStatement: 'BALANCE_SHEET' | 'INCOME_STATEMENT';
  displayOrder: number;
}

export interface JournalLine {
  targetAccount: string;
  /** Required when targetAccount is a control account (i.e. a GL account that subledger
   *  accounts post through) — the backend rejects control-account lines without one. */
  subledgerAccountId: string;
  description: string;
  debit: number | '';
  credit: number | '';
}

export interface JournalEntryFormValues {
  transactionDate: string;
  fiscalPeriodId: string;
  currency: string;
  exchangeRate: number | '';
  reference: string;
  description: string;
  lines: JournalLine[];
}

export const JOURNAL_ENTRY_DEFAULTS: JournalEntryFormValues = {
  transactionDate: '',
  fiscalPeriodId: '',
  currency: '',
  exchangeRate: '',
  reference: '',
  description: '',
  lines: [
    { targetAccount: '', subledgerAccountId: '', description: '', debit: '', credit: '' },
    { targetAccount: '', subledgerAccountId: '', description: '', debit: '', credit: '' },
  ],
};

export type JournalRecordStatus = 'DRAFT' | 'POSTED' | 'REVERSED';

export type SourceEventStatus = 'RECEIVED' | 'PROCESSING' | 'POSTED' | 'FAILED' | 'IGNORED';

export interface SourceEventInboxItem {
  id: string;
  sourceModule: string;
  sourceEventType: string;
  sourceRecordId: string;
  sourceDocumentId: string | null;
  idempotencyKey: string;
  status: SourceEventStatus;
  failureReason: string | null;
  retryCount: number;
  createdAt: string;
  processedAt: string | null;
  postingRule: {
    id: string;
    name: string;
    sourceModule: string;
    sourceEventType: string;
    version: number;
  } | null;
  journalEntry: {
    id: string;
    journalNumber: string;
    status: JournalRecordStatus;
    transactionDate: string;
    transactionCurrency: string;
    baseCurrency: string;
    postedAt: string | null;
  } | null;
  cashbookTransaction: {
    id: string;
    status: JournalRecordStatus;
    transactionType: string;
    direction: string;
    amount: string;
    currency: string;
    cashAccountId: string;
    postedJournalEntryId: string | null;
  } | null;
}

export interface JournalLineRecord {
  id: string;
  glAccountId: string;
  subledgerAccountId: string | null;
  costCentreId: string | null;
  description: string | null;
  transactionDebit: number;
  transactionCredit: number;
  baseDebit: number;
  baseCredit: number;
  glAccount: { id: string; code: string; name: string };
  subledgerAccount: { id: string; code: string; name: string } | null;
  costCentre: { id: string; code: string; name: string } | null;
}

export interface JournalEntryRecord {
  id: string;
  journalNumber: string;
  status: JournalRecordStatus;
  transactionDate: string;
  postingDate: string | null;
  fiscalPeriodId: string;
  transactionCurrency: string;
  baseCurrency: string;
  exchangeRate: string;
  reference: string | null;
  description: string;
  reversalOfJournalId: string | null;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  postedAt: string | null;
  reversedAt: string | null;
  lines: JournalLineRecord[];
}

export interface CreateJournalLinePayload {
  glAccountId: string;
  subledgerAccountId?: string;
  costCentreId?: string;
  description?: string;
  debit?: number;
  credit?: number;
}

export interface CreateJournalPayload {
  transactionDate: string;
  fiscalPeriodId: string;
  transactionCurrency: string;
  exchangeRate?: number;
  reference?: string;
  description: string;
  sourceModule?: string;
  sourceRecordType?: string;
  sourceRecordId?: string;
  lines: CreateJournalLinePayload[];
}

export type UpdateDraftJournalPayload = Partial<Omit<CreateJournalPayload, 'lines'>> & {
  lines?: CreateJournalLinePayload[];
};

export interface ReverseJournalPayload {
  reversalDate: string;
  reason: string;
}

export interface QueryJournalsParams {
  status?: JournalRecordStatus;
  from?: string;
  to?: string;
}

export interface InvoiceLine {
  description: string;
  glAccount: string;
  unitPrice: number | '';
  quantity: number | '';
  tax: number | '';
}

/** `vendor` holds the selected customer/vendor id (picked via SearchSelect, not
 * free text — the backend keys the invoice/bill to a real party record).
 * `invoiceNumber` is a user-facing reference only: the backend always generates
 * its own document number, so this maps to `externalReference` on submit. */
export interface InvoiceFormValues {
  vendor: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  currency: string;
  description: string;
  lines: InvoiceLine[];
}

export const INVOICE_DEFAULTS: InvoiceFormValues = {
  vendor: '',
  invoiceNumber: '',
  invoiceDate: '',
  dueDate: '',
  currency: '',
  description: '',
  lines: [{ description: '', glAccount: '', unitPrice: '', quantity: '', tax: '' }],
};

export type AccountingTradeSide = 'RECEIVABLE' | 'PAYABLE';
export type AccountingTradeDocumentStatus = 'DRAFT' | 'POSTED' | 'REVERSED';
export type AccountingTradeDocumentKind = 'INVOICE' | 'CREDIT_NOTE' | 'BILL';
export type AccountingTradeDocumentPaymentState =
  | 'DRAFT'
  | 'REVERSED'
  | 'PAID'
  | 'PARTIALLY_PAID'
  | 'OPEN';

export interface AccountingTradePartyRef {
  id: string;
  code: string;
  legalName: string;
  currency: string;
}

interface AccountingTradeGLAccountRef {
  id: string;
  code: string;
  name: string;
}

interface AccountingTradeJournalRef {
  id: string;
  journalNumber: string;
  status: string;
  postedAt: string | null;
}

interface AccountingTradeOriginalDocumentRef {
  id: string;
  documentNumber: string;
  totalAmount: string;
  status: string;
}

/** Normalized shape for both AR invoices and AP bills — the backend records are
 * structurally identical (customerId/vendorId aside), so the frontend reads them
 * through one shared `party` field instead of juggling two near-duplicate types. */
export interface AccountingTradeDocument {
  id: string;
  side: AccountingTradeSide;
  documentType: AccountingTradeDocumentKind;
  documentNumber: string;
  documentDate: string;
  dueDate: string | null;
  currency: string;
  exchangeRate: string | null;
  subtotalAmount: string;
  taxAmount: string;
  totalAmount: string;
  description: string | null;
  externalReference: string | null;
  sourceModule: string | null;
  sourceRecordId: string | null;
  offsetGlAccountId: string;
  originalDocumentId: string | null;
  status: AccountingTradeDocumentStatus;
  createdAt: string;
  updatedAt: string;
  postedAt: string | null;
  reversedAt: string | null;
  postedJournalEntryId: string | null;
  reversalJournalEntryId: string | null;
  reversalOfDocumentId: string | null;
  party: AccountingTradePartyRef;
  offsetGlAccount: AccountingTradeGLAccountRef;
  postedJournalEntry: AccountingTradeJournalRef | null;
  reversalJournalEntry: AccountingTradeJournalRef | null;
  originalDocument: AccountingTradeOriginalDocumentRef | null;
}

export interface QueryTradeDocumentsParams {
  partyId?: string;
  status?: AccountingTradeDocumentStatus;
  currency?: string;
  fromDate?: string;
  toDate?: string;
  dueFrom?: string;
  dueTo?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface CreateTradeInvoicePayload {
  partyId: string;
  documentDate: string;
  dueDate?: string;
  currency: string;
  amount: number;
  taxAmount?: number;
  exchangeRate?: number;
  offsetGlAccountId: string;
  description?: string;
  externalReference?: string;
}

export interface ReverseTradeDocumentPayload {
  reversalDate: string;
  reason: string;
}

export interface AccountingTradeDocumentBalance {
  currency: string;
  originalAmount: string;
  /** Applied receipts (AR) or applied payments (AP), normalized to one field name. */
  appliedSettlements: string;
  appliedCreditNotes: string;
  outstandingAmount: string;
  paymentState: AccountingTradeDocumentPaymentState;
}

export interface AccountingCurrencyTotal {
  currency: string;
  amount: string;
}

export interface AccountsReceivableSummary {
  outstandingByCurrency: AccountingCurrencyTotal[];
  overdueInvoices: number;
  dueThisWeek: number;
  collectedMtdByCurrency: AccountingCurrencyTotal[];
}

export interface AccountsPayableSummary {
  outstandingByCurrency: AccountingCurrencyTotal[];
  overdueInvoices: number;
  dueThisWeek: number;
  pendingApproval: number;
  paidMtdByCurrency: AccountingCurrencyTotal[];
}

export interface CreateTradeCreditNotePayload {
  partyId: string;
  documentDate: string;
  currency: string;
  amount: number;
  offsetGlAccountId: string;
  /** Optional posted invoice/bill this credit note applies against. */
  originalDocumentId?: string;
  description?: string;
  externalReference?: string;
}

/** AR customer receipts and AP vendor payments — cash-account-linked settlements
 * that post through Cashbook. Structurally identical apart from the party
 * relation and the receiptDate/paymentDate field name, same as trade documents. */
export interface AccountingTradeSettlement {
  id: string;
  side: AccountingTradeSide;
  settlementNumber: string;
  settlementDate: string;
  currency: string;
  amount: string;
  exchangeRate: string | null;
  reference: string | null;
  description: string | null;
  externalReference: string | null;
  sourceModule: string | null;
  sourceRecordId: string | null;
  status: AccountingTradeDocumentStatus;
  createdAt: string;
  updatedAt: string;
  postedAt: string | null;
  reversedAt: string | null;
  reversalOfSettlementId: string | null;
  party: AccountingTradePartyRef;
  cashbookTransaction: {
    id: string;
    status: string;
    reference: string | null;
    postedJournalEntryId: string | null;
    reversalJournalEntryId: string | null;
  };
}

export interface QueryTradeSettlementsParams {
  partyId?: string;
  cashAccountId?: string;
  status?: AccountingTradeDocumentStatus;
  currency?: string;
  fromDate?: string;
  toDate?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface CreateTradeSettlementPayload {
  partyId: string;
  cashAccountId: string;
  amount: number;
  currency: string;
  settlementDate: string;
  settlementMethod: AccountingCashbookSettlementMethod;
  reference?: string;
  description?: string;
  exchangeRate?: number;
}

export type AccountingTradeAllocationSource = 'RECEIPT' | 'PAYMENT' | 'CREDIT_NOTE';

export interface AccountingTradeAllocation {
  id: string;
  amount: string;
  currency: string;
  allocatedAt: string;
  sourceType: AccountingTradeAllocationSource;
  reversedAt: string | null;
  reversalReason: string | null;
  document: { id: string; documentNumber: string; totalAmount: string };
}

export interface CreateTradeAllocationPayload {
  /** The posted invoice (AR) or bill (AP) this receipt/credit note is being applied to. */
  documentId: string;
  amount: number;
}

export interface ReverseTradeAllocationPayload {
  reason: string;
}

export interface AccountingContact {
  id: string;
  fullName: string;
  jobTitle: string | null;
  email: string | null;
  phone: string | null;
  isPrimary: boolean;
}

export interface AccountingSubledgerBalance {
  baseDebit: number;
  baseCredit: number;
  baseBalance: number;
  transactionDebit: number;
  transactionCredit: number;
  transactionBalance: number;
  transactionCurrencies: string[];
}

export interface AccountingSubledgerRef {
  id: string;
  code: string;
  name: string;
  status: string;
}

export type AccountingCashAccountKind = 'BANK' | 'CASH' | 'MOBILE_MONEY' | 'OTHER';

export interface AccountingCashAccount {
  id: string;
  name: string;
  accountKind: AccountingCashAccountKind;
  currency: string;
  glAccountId: string;
  bankName: string | null;
  accountNumber: string | null;
  branch: string | null;
  description: string | null;
  isActive: boolean;
  createdByUserId: string;
  updatedByUserId: string;
  createdAt: string;
  updatedAt: string;
  glAccount: {
    id: string;
    code: string;
    name: string;
    category: GLAccountCategory;
  };
}

export interface QueryCashAccountsParams {
  accountKind?: AccountingCashAccountKind;
  currency?: string;
  isActive?: boolean;
}

export interface CreateCashAccountPayload {
  name: string;
  accountKind: AccountingCashAccountKind;
  currency: string;
  glAccountId: string;
  bankName?: string;
  accountNumber?: string;
  branch?: string;
  description?: string;
}

export interface UpdateCashAccountPayload extends Partial<CreateCashAccountPayload> {
  isActive?: boolean;
}

export type CashbookTransactionType = 'RECEIPT' | 'PAYMENT' | 'TRANSFER' | 'CHARGE' | 'ADJUSTMENT';
export type CashbookDirection = 'INFLOW' | 'OUTFLOW' | 'TRANSFER';
export type CashbookTransactionStatus = 'DRAFT' | 'POSTED' | 'REVERSED';
export type AccountingCashbookSettlementMethod =
  | 'BANK_TRANSFER'
  | 'CHEQUE'
  | 'CASH'
  | 'MOBILE_MONEY'
  | 'INTERNAL_TRANSFER'
  | 'JOURNAL'
  | 'OTHER';

export interface CashbookAccountRef {
  id: string;
  name: string;
  accountKind: AccountingCashAccountKind;
  currency: string;
  glAccountId: string;
  glAccount: { id: string; code: string; name: string };
}

interface CashbookGLAccountRef {
  id: string;
  code: string;
  name: string;
}

interface CashbookJournalRef {
  id: string;
  journalNumber: string;
  status: string;
  postedAt: string | null;
}

interface CashbookTransactionRef {
  id: string;
  reference: string | null;
  status: string;
}

export interface CashbookTransaction {
  id: string;
  cashAccountId: string;
  destinationCashAccountId: string | null;
  transactionType: CashbookTransactionType;
  direction: CashbookDirection;
  amount: string;
  currency: string;
  transactionDate: string;
  settlementMethod: AccountingCashbookSettlementMethod;
  reference: string | null;
  counterpartyType: string | null;
  counterpartyId: string | null;
  externalReference: string | null;
  description: string;
  offsetGlAccountId: string | null;
  offsetSubledgerAccountId: string | null;
  sourceEventInboxId: string | null;
  sourceModule: string | null;
  sourceEventType: string | null;
  sourceRecordId: string | null;
  sourceReference: string | null;
  exchangeRate: string | null;
  status: CashbookTransactionStatus;
  createdByUserId: string;
  updatedByUserId: string;
  postedByUserId: string | null;
  reversedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
  postedAt: string | null;
  reversedAt: string | null;
  postedJournalEntryId: string | null;
  reversalJournalEntryId: string | null;
  reversalOfTransactionId: string | null;
  cashAccount: CashbookAccountRef;
  destinationCashAccount: CashbookAccountRef | null;
  offsetGlAccount: CashbookGLAccountRef | null;
  offsetSubledgerAccount: (CashbookGLAccountRef & { type: string }) | null;
  postedJournalEntry: CashbookJournalRef | null;
  reversalJournalEntry: CashbookJournalRef | null;
  reversalOfTransaction: CashbookTransactionRef | null;
  reversalTransaction: CashbookTransactionRef | null;
}

export interface QueryCashbookParams {
  cashAccountId?: string;
  transactionType?: CashbookTransactionType;
  status?: CashbookTransactionStatus;
  currency?: string;
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
}

export interface CreateCashbookEntryPayload {
  cashAccountId: string;
  amount: number;
  currency: string;
  transactionDate: string;
  settlementMethod: AccountingCashbookSettlementMethod;
  reference?: string;
  counterpartyType?: string;
  counterpartyId?: string;
  externalReference?: string;
  description: string;
  offsetGlAccountId: string;
  offsetSubledgerAccountId?: string;
  exchangeRate?: number;
}

export interface CreateCashbookAdjustmentPayload extends CreateCashbookEntryPayload {
  direction: 'INFLOW' | 'OUTFLOW';
}

export interface CreateCashbookTransferPayload {
  cashAccountId: string;
  destinationCashAccountId: string;
  amount: number;
  currency: string;
  transactionDate: string;
  exchangeRate?: number;
  reference?: string;
  description: string;
}

export interface ReverseCashbookTransactionPayload {
  reversalDate: string;
  reason: string;
}

export interface QueryAccountingPartiesParams {
  search?: string;
  isActive?: boolean;
  currency?: string;
  sourceModule?: string;
  externalRef?: string;
  page?: number;
  limit?: number;
  sortBy?: 'code' | 'legalName' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export type SubledgerType =
  | 'CUSTOMER'
  | 'VENDOR'
  | 'CEDANT'
  | 'REINSURER'
  | 'EMPLOYEE'
  | 'STATUTORY'
  | 'OTHER';

/** Types creatable manually from Accounting Settings → Entities. CEDANT and REINSURER
 *  subledgers are provisioned by the reinsurance service via its internal ensure endpoint —
 *  creating them here risks colliding with (or orphaning from) that flow. */
export const MANUAL_SUBLEDGER_TYPES: SubledgerType[] = [
  'CUSTOMER',
  'VENDOR',
  'EMPLOYEE',
  'STATUTORY',
  'OTHER',
];

export const SUBLEDGER_TYPE_LABELS: Record<SubledgerType, string> = {
  CUSTOMER: 'Customer',
  VENDOR: 'Vendor',
  CEDANT: 'Cedant',
  REINSURER: 'Reinsurer',
  EMPLOYEE: 'Employee',
  STATUTORY: 'Statutory',
  OTHER: 'Other',
};

/** Which side of the ledger a tenant-defined Entity Type posts to: RECEIVABLE for
 *  customer-like entities, PAYABLE for vendor-like ones, BOTH for entities that can carry
 *  either (e.g. a party that's sometimes billed, sometimes bills you), and NONE for entities
 *  that don't flow through AP/AR at all (e.g. Employee, Statutory, Other). */
export type EntityAccountingRelation = 'RECEIVABLE' | 'PAYABLE' | 'BOTH' | 'NONE';

export const ENTITY_ACCOUNTING_RELATION_LABELS: Record<EntityAccountingRelation, string> = {
  RECEIVABLE: 'Receivable',
  PAYABLE: 'Payable',
  BOTH: 'Both',
  NONE: 'None',
};

/** Fallback accounting relation for the fixed `SubledgerType` values, used wherever an entity
 *  isn't (yet) resolvable against a tenant-configured `EntityType` — e.g. before the
 *  entity-types endpoint exists, or for a type with no custom relation configured. CEDANT and
 *  REINSURER default to BOTH since a reinsurance counterparty can carry either a receivable or
 *  a payable position depending on settlement direction. */
export const DEFAULT_ENTITY_ACCOUNTING_RELATION: Record<SubledgerType, EntityAccountingRelation> =
  {
    CUSTOMER: 'RECEIVABLE',
    VENDOR: 'PAYABLE',
    CEDANT: 'BOTH',
    REINSURER: 'BOTH',
    EMPLOYEE: 'NONE',
    STATUTORY: 'NONE',
    OTHER: 'NONE',
  };

/** A label available in the Entity "Type" field. The base set — Customer, Vendor, Employee,
 *  Statutory, Other — is system-seeded (`isSystem: true`) and can't be deleted; a tenant can
 *  add further custom ones (e.g. "Landlord", "Government Agency") alongside them, each mapped
 *  to the accounting relation that drives whether entities of that type can carry a
 *  receivable balance, a payable balance, both, or neither. */
export interface EntityType {
  id: string;
  name: string;
  accountingRelation: EntityAccountingRelation;
  isSystem: boolean;
  entityCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEntityTypePayload {
  name: string;
  accountingRelation: EntityAccountingRelation;
}

export interface SubledgerAccount {
  id: string;
  code: string;
  name: string;
  type: SubledgerType;
  externalRef: string | null;
  controlAccountId: string;
  controlAccount: {
    id: string;
    code: string;
    name: string;
    category: GLAccountCategory;
    normalBalance: NormalBalance;
  };
  currency: string | null;
  status: GLAccountStatus;
  balance: AccountingSubledgerBalance;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSubledgerAccountPayload {
  code: string;
  name: string;
  type: SubledgerType;
  externalRef?: string;
  controlAccountId: string;
  currency?: string;
}

export type UpdateSubledgerAccountPayload = Partial<CreateSubledgerAccountPayload>;

export interface QuerySubledgerAccountsParams {
  type?: SubledgerType;
  externalRef?: string;
  controlAccountId?: string;
  status?: GLAccountStatus;
}

export interface AccountingVendor {
  id: string;
  code: string;
  legalName: string;
  tradingName: string | null;
  primaryContactName: string | null;
  email: string | null;
  phone: string | null;
  billingAddress: string | null;
  countryCode: string | null;
  currency: string;
  paymentTermsDays: number;
  taxNumber: string | null;
  externalRef: string | null;
  sourceModule: string | null;
  defaultExpenseAccountId: string | null;
  notes: string | null;
  isActive: boolean;
  subledgerAccountId: string;
  subledgerAccount: AccountingSubledgerRef;
  balance: AccountingSubledgerBalance;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAccountingVendorPayload {
  code: string;
  legalName: string;
  tradingName?: string;
  primaryContactName?: string;
  email?: string;
  phone?: string;
  billingAddress?: string;
  countryCode?: string;
  currency: string;
  paymentTermsDays?: number;
  taxNumber?: string;
  externalRef?: string;
  sourceModule?: string;
  defaultExpenseAccountId?: string;
  notes?: string;
}

export type UpdateAccountingVendorPayload = Partial<CreateAccountingVendorPayload> & {
  isActive?: boolean;
};

export interface AccountingCurrency {
  id: string;
  code: string;
  name: string;
  symbol: string | null;
  decimalPlaces: number;
  isActive: boolean;
}

export interface CreateAccountingCurrencyPayload {
  code: string;
  name: string;
  symbol?: string;
  decimalPlaces?: number;
}

export interface UpdateAccountingCurrencyPayload {
  code?: string;
  name?: string;
  symbol?: string;
  decimalPlaces?: number;
  isActive?: boolean;
}

export interface AccountingTenantConfig {
  baseCurrency: string | null;
  fiscalYearStartMonth: number;
  decimalPlaces: number;
  accountsReceivableControlAccountId: string | null;
  accountsPayableControlAccountId: string | null;
  accountsReceivableControlAccount?: {
    id: string;
    code: string;
    name: string;
    category: GLAccountCategory;
  } | null;
  accountsPayableControlAccount?: {
    id: string;
    code: string;
    name: string;
    category: GLAccountCategory;
  } | null;
  isConfigured?: boolean;
}

export interface UpdateAccountingTenantConfigPayload {
  baseCurrency?: string;
  fiscalYearStartMonth?: number;
  decimalPlaces?: number;
  accountsReceivableControlAccountId?: string;
  accountsPayableControlAccountId?: string;
}

export interface ExchangeRate {
  id: string;
  fromCurrency: string;
  toCurrency: string;
  rate: string;
  effectiveAt: string;
  isActive: boolean;
}

export interface CreateExchangeRatePayload {
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  effectiveAt: string;
}

export interface UpdateExchangeRatePayload {
  rate?: number;
  effectiveAt?: string;
  isActive?: boolean;
}

export type AccountTransactionType = 'Credit' | 'Debit';

export interface AccountTransaction {
  id: string;
  date: string;
  description: string;
  reference: string;
  type: AccountTransactionType;
  debit: number | null;
  credit: number | null;
  balance: number;
  currency: string;
}

export type AgingBucket = 'CURRENT' | '1_30' | '31_60' | '61_90' | 'OVER_90';

export interface AccountingAgingCurrencyTotal extends Record<AgingBucket, string> {
  currency: string;
}

export interface AccountingOpenItem {
  id: string;
  documentNumber: string;
  documentDate: string;
  dueDate: string | null;
  currency: string;
  totalAmount: string;
  outstandingAmount: string;
}

export interface AccountingAgingReport {
  agingByCurrency: AccountingAgingCurrencyTotal[];
}

export interface AccountingPartyStatement extends AccountingAgingReport {
  asOfDate: string;
  documents: AccountingOpenItem[];
}

export interface AccountClassification {
  id: string;
  code: string;
  name: string;
  category: GLAccountCategory;
  displayOrder: number;
  isSystemTemplate: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAccountClassificationPayload {
  code: string;
  name: string;
  category: GLAccountCategory;
  displayOrder?: number;
  isSystemTemplate?: boolean;
}

export type UpdateAccountClassificationPayload = Partial<CreateAccountClassificationPayload> & {
  isActive?: boolean;
};

export interface QueryAccountHierarchyParams {
  category?: GLAccountCategory;
  isActive?: boolean;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: 'code' | 'name' | 'displayOrder' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

export interface AccountGroup {
  id: string;
  code: string;
  name: string;
  classificationId: string;
  classification: {
    id: string;
    code: string;
    name: string;
    category: GLAccountCategory;
  };
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAccountGroupPayload {
  classificationId: string;
  code: string;
  name: string;
  displayOrder?: number;
}

export type UpdateAccountGroupPayload = Partial<CreateAccountGroupPayload> & {
  isActive?: boolean;
};

export interface QueryAccountGroupsParams extends QueryAccountHierarchyParams {
  classificationId?: string;
}

export interface CashBankAccount {
  id: string;
  accountCode: string;
  accountName: string;
  bankName: string;
  currency: string;
  bookBalance: number;
  lastReconciled: string | null;
}

export interface BudgetForecast {
  id: string;
  budgetName: string;
  department: string;
  fiscalYear: string;
  version: string;
  amount: number;
  actualSpend: number;
  currency: string;
}

export interface AccountingCustomer {
  id: string;
  code: string;
  legalName: string;
  tradingName: string | null;
  primaryContactName: string | null;
  email: string | null;
  phone: string | null;
  billingAddress: string | null;
  countryCode: string | null;
  currency: string;
  paymentTermsDays: number;
  creditLimit: number | null;
  taxNumber: string | null;
  externalRef: string | null;
  sourceModule: string | null;
  notes: string | null;
  isActive: boolean;
  subledgerAccountId: string;
  subledgerAccount: AccountingSubledgerRef;
  balance: AccountingSubledgerBalance;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAccountingCustomerPayload {
  code: string;
  legalName: string;
  tradingName?: string;
  primaryContactName?: string;
  email?: string;
  phone?: string;
  billingAddress?: string;
  countryCode?: string;
  currency: string;
  paymentTermsDays?: number;
  creditLimit?: number;
  taxNumber?: string;
  externalRef?: string;
  sourceModule?: string;
  notes?: string;
}

export type UpdateAccountingCustomerPayload = Partial<CreateAccountingCustomerPayload> & {
  isActive?: boolean;
};

export type PostingRuleDirection = 'DR' | 'CR';
export type PostingRuleSubledgerType = SubledgerType;

export interface PostingRuleLine {
  id: string;
  sequence: number;
  direction: PostingRuleDirection;
  glAccountId: string;
  subledgerType: PostingRuleSubledgerType | null;
  subledgerExternalRefSource: string | null;
  amountSource: string;
  currencySource: string;
  descriptionTemplate: string;
  glAccount: { id: string; code: string; name: string; status: string };
}

/** Maps one source business event (sourceModule + sourceEventType) to a balanced
 * set of journal lines. The highest-`version` active rule whose effective date
 * range covers the event's transaction date is the one the posting engine uses —
 * no match means the event can't be posted (the `POSTING_RULE_MISSING` blocker
 * behind "Accounting is not ready to recognize X" errors elsewhere in the app). */
export interface PostingRule {
  id: string;
  name: string;
  sourceModule: string;
  sourceEventType: string;
  version: number;
  active: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
  createdAt: string;
  updatedAt: string;
  lines: PostingRuleLine[];
}

export interface QueryPostingRulesParams {
  sourceModule?: string;
  sourceEventType?: string;
  active?: boolean;
}

export interface PostingRuleLineInput {
  sequence: number;
  direction: PostingRuleDirection;
  glAccountId: string;
  subledgerType?: PostingRuleSubledgerType;
  /** Dot-path into the source event payload used to resolve the subledger's
   * external reference, e.g. "counterparty.id". Only meaningful with subledgerType set. */
  subledgerExternalRefSource?: string;
  /** Dot-path into the source event payload for this line's amount, e.g. "amounts.netPremium". */
  amountSource: string;
  /** Dot-path into the source event payload for this line's currency, e.g. "currency". */
  currencySource: string;
  /** Supports {{sourceRecordId}}, {{sourceDocumentId}} and {{payload.x}} interpolation. */
  descriptionTemplate: string;
}

export interface CreatePostingRulePayload {
  name: string;
  sourceModule: string;
  sourceEventType: string;
  version: number;
  active?: boolean;
  effectiveFrom: string;
  effectiveTo?: string;
  lines?: PostingRuleLineInput[];
}

export interface UpdatePostingRulePayload {
  name?: string;
  active?: boolean;
  effectiveFrom?: string;
  effectiveTo?: string;
}

export type CreatePostingRuleLinePayload = PostingRuleLineInput;
export type UpdatePostingRuleLinePayload = Partial<PostingRuleLineInput>;
