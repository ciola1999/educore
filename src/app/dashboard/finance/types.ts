export type FinanceJournalLineView = {
  id: string;
  debit: number;
  credit: number;
  account: {
    code: string;
    name: string;
    type: string;
  };
};

export type FinanceJournalEntryView = {
  id: string;
  date: Date | string;
  description: string;
  referenceId: string | null;
  referenceType: string | null;
  isAutoPost: boolean;
  lines: FinanceJournalLineView[];
};

export type FinanceAuditLogView = {
  id: string;
  action: string;
  actor: {
    fullName: string;
  };
  details: string | null;
  createdAt: Date | string;
};

export type FinancePaymentMethodView = {
  id: string;
  code: string | null;
  name: string;
  isElectronic: boolean;
};

export type FinanceInvoiceStatusView =
  | "DRAFT"
  | "OPEN"
  | "PARTIAL"
  | "PAID"
  | "OVERPAID"
  | "OVERDUE"
  | "VOID"
  | "WRITEOFF";

export type FinanceInvoiceListItemView = {
  id: string;
  invoiceNo: string;
  status: FinanceInvoiceStatusView;
  baseStatus:
    | "DRAFT"
    | "OPEN"
    | "PARTIAL"
    | "PAID"
    | "OVERPAID"
    | "VOID"
    | "WRITEOFF";
  totalAmount: number;
  outstanding: number;
  dueDate: Date | string;
  studentSnapshot: string | null;
};
