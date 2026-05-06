import { z } from "zod";

// ================================
// FINANCE ENUMS & CONSTANTS
// ================================

export const InvoiceStatusEnum = z.enum([
  "DRAFT",
  "OPEN",
  "PARTIAL",
  "PAID",
  "OVERPAID",
  "VOID",
  "WRITEOFF",
]);

export const BillingBatchStatusEnum = z.enum([
  "DRAFT",
  "PROCESSED",
  "CANCELLED",
]);

export const AccountTypeEnum = z.enum([
  "ASSET",
  "LIABILITY",
  "EQUITY",
  "REVENUE",
  "EXPENSE",
]);

export const FinancePeriodStatusEnum = z.enum([
  "OPEN",
  "SOFT_CLOSED",
  "CLOSED",
]);

// ================================
// MASTER DATA SCHEMAS
// ================================

export const billingCategorySchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(2, "Nama kategori minimal 2 karakter"),
  description: z.string().max(255).optional().nullable(),
  isActive: z.boolean().default(true),
});

export const paymentMethodSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(2, "Nama metode minimal 2 karakter"),
  code: z.string().max(20).optional().nullable(),
  isElectronic: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export const accountSchema = z.object({
  id: z.string().uuid().optional(),
  code: z.string().min(1, "Kode akun wajib diisi"),
  name: z.string().min(2, "Nama akun minimal 2 karakter"),
  type: AccountTypeEnum,
});

// ================================
// BILLING ENGINE SCHEMAS
// ================================

export const invoiceItemSchema = z.object({
  description: z.string().min(2, "Deskripsi item minimal 2 karakter"),
  amount: z.number().int().min(1000, "Nominal item invoice minimal Rp1.000"),
});

export const createInvoiceSchema = z.object({
  studentId: z.string().uuid("Student ID tidak valid"),
  categoryId: z.string().uuid("Category ID tidak valid"),
  dueDate: z.coerce.date(),
  items: z.array(invoiceItemSchema).min(1, "Minimal harus ada 1 item"),
  batchId: z.string().uuid().optional(),
  notes: z.string().optional(),
});

export const createBillingBatchSchema = z
  .object({
    name: z.string().min(2, "Nama batch minimal 2 karakter"),
    description: z.string().max(255).optional().nullable(),
    categoryId: z.string().uuid("Category ID tidak valid"),
    dueDate: z.coerce.date(),
    items: z.array(invoiceItemSchema).min(1, "Minimal harus ada 1 item"),
    targetMode: z
      .enum(["ALL_STUDENTS", "SELECTED_STUDENTS"])
      .default("ALL_STUDENTS"),
    studentIds: z.array(z.string().uuid()).default([]),
  })
  .superRefine((value, ctx) => {
    if (
      value.targetMode === "SELECTED_STUDENTS" &&
      value.studentIds.length === 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Minimal pilih 1 siswa",
        path: ["studentIds"],
      });
    }
  });

export const invoiceItemInputSchema = z.object({
  description: z.string().min(2, "Deskripsi item minimal 2 karakter"),
  amount: z.number().int().min(1000, "Nominal item invoice minimal Rp1.000"),
});

export const paymentAllocationInputSchema = z.object({
  invoiceId: z.string().uuid("Invoice ID tidak valid"),
  amount: z.number().int().min(1, "Jumlah alokasi minimal 1"),
});

export const processPaymentSchema = z.object({
  studentId: z.string().uuid("Student ID tidak valid"),
  methodId: z.string().uuid("Method ID tidak valid"),
  amount: z.number().int().min(1, "Jumlah pembayaran minimal 1"),
  date: z.coerce.date(),
  requestId: z.string().uuid("Request ID pembayaran tidak valid").optional(),
  referenceNo: z.string().max(100).optional().nullable(),
  notes: z.string().max(255).optional().nullable(),
  allocations: z.array(paymentAllocationInputSchema).optional(), // Manual allocation
  useCreditBalance: z.boolean().default(false), // Option to use existing overpayment
});

export const applyCreditToInvoicesSchema = z.object({
  studentId: z.string().uuid("Student ID tidak valid"),
  invoiceIds: z.array(z.string().uuid("Invoice ID tidak valid")).default([]),
  amount: z.number().int().min(1, "Nominal credit minimal 1").optional(),
  reason: z.string().min(5, "Alasan apply credit minimal 5 karakter"),
  requestId: z.string().uuid("Request ID apply credit tidak valid").optional(),
  date: z.coerce.date().optional(),
});

export const createFinancePeriodSchema = z
  .object({
    name: z.string().min(2, "Nama periode minimal 2 karakter"),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
  })
  .refine((value) => value.endDate.getTime() >= value.startDate.getTime(), {
    message: "Tanggal akhir periode harus setelah tanggal mulai",
    path: ["endDate"],
  });

export const updateFinancePeriodStatusSchema = z.object({
  status: FinancePeriodStatusEnum,
  reason: z.string().min(5, "Alasan perubahan periode minimal 5 karakter"),
});

export const manualJournalAdjustmentLineSchema = z
  .object({
    accountId: z.string().uuid("Akun jurnal tidak valid"),
    debit: z.number().int().min(0, "Debit tidak boleh negatif"),
    credit: z.number().int().min(0, "Kredit tidak boleh negatif"),
  })
  .refine((line) => line.debit > 0 || line.credit > 0, {
    message: "Minimal salah satu sisi debit atau kredit harus diisi",
  })
  .refine((line) => !(line.debit > 0 && line.credit > 0), {
    message:
      "Satu baris jurnal tidak boleh memiliki debit dan kredit sekaligus",
  });

export const manualJournalAdjustmentSchema = z
  .object({
    date: z.coerce.date(),
    description: z.string().min(5, "Deskripsi adjustment minimal 5 karakter"),
    reason: z.string().min(5, "Alasan adjustment minimal 5 karakter"),
    lines: z
      .array(manualJournalAdjustmentLineSchema)
      .min(2, "Minimal harus ada 2 baris jurnal"),
  })
  .superRefine((value, ctx) => {
    const totalDebit = value.lines.reduce((sum, line) => sum + line.debit, 0);
    const totalCredit = value.lines.reduce((sum, line) => sum + line.credit, 0);

    if (totalDebit !== totalCredit) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Total debit dan kredit harus seimbang",
        path: ["lines"],
      });
    }
  });

export type BillingCategoryInput = z.infer<typeof billingCategorySchema>;
export type PaymentMethodInput = z.infer<typeof paymentMethodSchema>;
export type AccountInput = z.infer<typeof accountSchema>;
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type CreateBillingBatchInput = z.infer<typeof createBillingBatchSchema>;
export type InvoiceItemInput = z.infer<typeof invoiceItemSchema>;
export type PaymentAllocationInput = z.infer<
  typeof paymentAllocationInputSchema
>;
export type ProcessPaymentInput = z.infer<typeof processPaymentSchema>;
export type ApplyCreditToInvoicesInput = z.infer<
  typeof applyCreditToInvoicesSchema
>;
export type CreateFinancePeriodInput = z.infer<
  typeof createFinancePeriodSchema
>;
export type UpdateFinancePeriodStatusInput = z.infer<
  typeof updateFinancePeriodStatusSchema
>;
export type ManualJournalAdjustmentInput = z.infer<
  typeof manualJournalAdjustmentSchema
>;
