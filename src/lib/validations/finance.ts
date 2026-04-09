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
  amount: z.number().int().min(0, "Jumlah tidak boleh negatif"),
});

export const createInvoiceSchema = z.object({
  studentId: z.string().uuid("Student ID tidak valid"),
  categoryId: z.string().uuid("Category ID tidak valid"),
  dueDate: z.coerce.date(),
  items: z.array(invoiceItemSchema).min(1, "Minimal harus ada 1 item"),
  batchId: z.string().uuid().optional(),
  notes: z.string().optional(),
});

export const createBillingBatchSchema = z.object({
  name: z.string().min(2, "Nama batch minimal 2 karakter"),
  description: z.string().max(255).optional().nullable(),
  categoryId: z.string().uuid("Category ID tidak valid"),
  dueDate: z.coerce.date(),
  items: z.array(invoiceItemSchema).min(1, "Minimal harus ada 1 item"),
  studentIds: z.array(z.string().uuid()).min(1, "Minimal pilih 1 siswa"),
});

export const invoiceItemInputSchema = z.object({
  description: z.string().min(2, "Deskripsi item minimal 2 karakter"),
  amount: z.number().int().min(0, "Jumlah tidak boleh negatif"),
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
  referenceNo: z.string().max(100).optional().nullable(),
  notes: z.string().max(255).optional().nullable(),
  allocations: z.array(paymentAllocationInputSchema).optional(), // Manual allocation
  useCreditBalance: z.boolean().default(false), // Option to use existing overpayment
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
