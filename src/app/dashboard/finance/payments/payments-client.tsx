"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Banknote,
  Calendar,
  CheckCircle2,
  Clock3,
  CreditCard,
  Download,
  Info,
  Loader2,
  Printer,
  Receipt,
  RotateCcw,
  Search,
  User,
  Users,
  Wallet,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  applyCreditToInvoicesRuntimeAction,
  processPaymentRuntimeAction,
} from "@/app/dashboard/finance/client-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { apiGet } from "@/lib/api/request";
import { cn, formatCurrency } from "@/lib/utils";
import {
  getStudentInvoicesAction,
  getStudentsWithOutstandingInvoicesAction,
  searchStudentsAction,
} from "../actions";

interface StudentResult {
  id: string;
  nis: string;
  fullName: string;
  grade: string;
  creditBalance?: number;
}

interface Invoice {
  id: string;
  invoiceNo: string;
  dueDate: string | Date;
  totalAmount: number;
  totalPaid: number;
  outstanding: number;
  studentSnapshot?: string;
  studentCreditBalance?: number;
}

interface PaymentMethod {
  id: string;
  code: string | null;
  name: string;
  isElectronic: boolean;
}

interface OutstandingStudentResult extends StudentResult {
  invoiceCount: number;
  totalOutstanding: number;
  netOutstanding?: number;
  oldestDueDate: string | Date | null;
  overdueCount: number;
}

type OutstandingStudentFilter = "all" | "overdue" | "largest";

interface PaymentResult {
  paymentNo: string;
  receiptNo: string;
  credit: number;
  creditUsed: number;
  creditAfter: number;
  amount: number;
  allocated: number;
  studentName: string;
  methodName: string;
  date: string;
  notes?: string;
  duplicate?: boolean;
}

interface CreditSettlementResult {
  creditReceiptNo: string;
  creditUsed: number;
  creditAfter: number;
  allocations: Array<{ invoiceId: string; invoiceNo?: string; amount: number }>;
  studentName: string;
  date: string;
  duplicate?: boolean;
}

function getAllocationTitle(invoice: Invoice) {
  if (!invoice.studentSnapshot) {
    return "Outstanding Invoice";
  }

  try {
    const snapshot = JSON.parse(invoice.studentSnapshot) as {
      categoryName?: string;
      fullName?: string;
    };
    return (
      snapshot.categoryName?.trim() ||
      snapshot.fullName?.trim() ||
      "Outstanding Invoice"
    );
  } catch {
    return "Outstanding Invoice";
  }
}

function parseRupiahInput(value: string) {
  const digitsOnly = value.replace(/\D/g, "");
  return digitsOnly ? Number(digitsOnly) : 0;
}

export function PaymentsClient({
  initialMethods,
  desktopRuntime = false,
  allowMutation = !desktopRuntime,
}: {
  initialMethods: PaymentMethod[];
  desktopRuntime?: boolean;
  allowMutation?: boolean;
}) {
  const [amount, setAmount] = useState<number>(0);
  const [selectedMethod, setSelectedMethod] = useState<string>(
    initialMethods[0]?.id || "",
  );
  const [paymentDate, setPaymentDate] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<StudentResult[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentResult | null>(
    null,
  );
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [outstandingStudents, setOutstandingStudents] = useState<
    OutstandingStudentResult[]
  >([]);
  const [outstandingFilter, setOutstandingFilter] =
    useState<OutstandingStudentFilter>("all");
  const [notes, setNotes] = useState("");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [paymentResult, setPaymentResult] = useState<PaymentResult | null>(
    null,
  );
  const [creditResult, setCreditResult] =
    useState<CreditSettlementResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(false);
  const [isLoadingOutstanding, setIsLoadingOutstanding] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    setPaymentDate(new Date().toISOString().split("T")[0]);
  }, []);

  const loadOutstandingStudents = async () => {
    setIsLoadingOutstanding(true);
    try {
      const results = desktopRuntime
        ? await apiGet<OutstandingStudentResult[]>(
            "/api/finance/students/outstanding?limit=250",
          )
        : await getStudentsWithOutstandingInvoicesAction();
      setOutstandingStudents(results as OutstandingStudentResult[]);
    } catch (error) {
      console.error(error);
      toast.error("Gagal memuat daftar siswa yang belum bayar.");
    } finally {
      setIsLoadingOutstanding(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setIsLoadingOutstanding(true);
      try {
        const results = desktopRuntime
          ? await apiGet<OutstandingStudentResult[]>(
              "/api/finance/students/outstanding?limit=250",
            )
          : await getStudentsWithOutstandingInvoicesAction();

        if (!cancelled) {
          setOutstandingStudents(results as OutstandingStudentResult[]);
        }
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          toast.error("Gagal memuat daftar siswa yang belum bayar.");
        }
      } finally {
        if (!cancelled) {
          setIsLoadingOutstanding(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [desktopRuntime]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchQuery.length >= 3) {
        setIsSearching(true);
        try {
          const results = desktopRuntime
            ? await apiGet<StudentResult[]>(
                `/api/finance/students?query=${encodeURIComponent(searchQuery)}`,
              )
            : await searchStudentsAction(searchQuery);
          setSearchResults(results as StudentResult[]);
        } catch (err) {
          console.error(err);
        } finally {
          setIsSearching(false);
        }
      } else {
        setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [desktopRuntime, searchQuery]);

  const loadStudentInvoices = async (studentId: string) => {
    setIsLoadingInvoices(true);
    try {
      const data = desktopRuntime
        ? await apiGet<Invoice[]>(`/api/finance/students/${studentId}/invoices`)
        : await getStudentInvoicesAction(studentId);
      setInvoices(data as Invoice[]);
    } catch {
      toast.error("Failed to load student invoices");
    } finally {
      setIsLoadingInvoices(false);
    }
  };

  // Fetch invoices when student selected
  const handleSelectStudent = async (student: StudentResult) => {
    setSelectedStudent(student);
    setSearchQuery("");
    setSearchResults([]);
    await loadStudentInvoices(student.id);
  };

  // Waterfall Allocation Logic
  const allocations = useMemo(() => {
    let remaining = amount;
    const sorted = [...invoices].sort(
      (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
    );

    return sorted.map((inv) => {
      const allocated = Math.min(inv.outstanding, remaining);
      remaining -= allocated;
      return { ...inv, allocated };
    });
  }, [amount, invoices]);

  const totalAllocated = allocations.reduce((sum, a) => sum + a.allocated, 0);
  const creditBalance = Math.max(amount - totalAllocated, 0);
  const totalOutstanding = invoices.reduce(
    (sum, invoice) => sum + invoice.outstanding,
    0,
  );
  const selectedStudentCreditBalance =
    selectedStudent?.creditBalance ??
    invoices[0]?.studentCreditBalance ??
    outstandingStudents.find((student) => student.id === selectedStudent?.id)
      ?.creditBalance ??
    0;
  const netPayable = Math.max(
    totalOutstanding - selectedStudentCreditBalance,
    0,
  );
  const isDepositPayment = Boolean(selectedStudent && invoices.length === 0);
  const requiresCreditConfirmation = creditBalance > 0 || isDepositPayment;
  const selectedMethodName =
    initialMethods.find((method) => method.id === selectedMethod)?.name ||
    "Payment";
  const canSubmitPayment =
    Boolean(selectedStudent) &&
    Boolean(selectedMethod) &&
    Boolean(paymentDate) &&
    amount > 0 &&
    allowMutation &&
    (!isDepositPayment || notes.trim().length >= 3);
  const shouldUseCreditBalance =
    selectedStudentCreditBalance > 0 && totalOutstanding > 0;
  const isCoveredByCredit =
    selectedStudentCreditBalance > 0 &&
    totalOutstanding > 0 &&
    selectedStudentCreditBalance >= totalOutstanding;
  const creditUsedPreview = shouldUseCreditBalance
    ? Math.min(selectedStudentCreditBalance, totalOutstanding)
    : 0;
  const cashDuePreview = Math.max(totalOutstanding - creditUsedPreview, 0);
  const transactionState = !selectedStudent
    ? "Select Student"
    : isDepositPayment
      ? "Deposit Only"
      : isCoveredByCredit
        ? "Covered by Credit"
        : creditUsedPreview > 0
          ? "Needs Cash"
          : amount > 0 && amount < totalOutstanding
            ? "Partial Payment"
            : "Needs Cash";
  const primaryActionLabel = isDepositPayment
    ? "SAVE DEPOSIT"
    : creditUsedPreview > 0 && !isCoveredByCredit
      ? "PAY NET DUE"
      : "EXECUTE PAYMENT";
  const primaryActionHelp = isDepositPayment
    ? "Siswa tanpa tagihan: nominal masuk sebagai deposit/credit."
    : isCoveredByCredit
      ? "Credit cukup untuk melunasi tagihan tanpa cash baru."
      : creditUsedPreview > 0
        ? "Credit dipakai dulu, cash hanya untuk sisa tagihan."
        : "Cash dialokasikan otomatis ke invoice tertua lebih dulu.";
  const displayedOutstandingStudents = useMemo(() => {
    const rows =
      outstandingFilter === "overdue"
        ? outstandingStudents.filter((student) => student.overdueCount > 0)
        : [...outstandingStudents];

    return rows.sort((a, b) => {
      if (outstandingFilter === "largest") {
        return b.totalOutstanding - a.totalOutstanding;
      }

      if (outstandingFilter === "overdue") {
        return (
          b.overdueCount - a.overdueCount ||
          b.totalOutstanding - a.totalOutstanding
        );
      }

      const aDue = a.oldestDueDate
        ? new Date(a.oldestDueDate).getTime()
        : Number.POSITIVE_INFINITY;
      const bDue = b.oldestDueDate
        ? new Date(b.oldestDueDate).getTime()
        : Number.POSITIVE_INFINITY;

      return aDue - bDue || b.totalOutstanding - a.totalOutstanding;
    });
  }, [outstandingFilter, outstandingStudents]);

  const buildReceiptContent = (result: PaymentResult) => {
    const lines = [
      "EDUCORE PAYMENT RECEIPT",
      "========================",
      `Receipt No : ${result.receiptNo}`,
      `Payment No : ${result.paymentNo}`,
      `Student    : ${result.studentName}`,
      `Date       : ${result.date}`,
      `Method     : ${result.methodName}`,
      `Amount     : ${formatCurrency(result.amount)}`,
      `Credit Used: ${formatCurrency(result.creditUsed)}`,
      `Settled    : ${formatCurrency(result.amount + result.creditUsed)}`,
      `Credit Left: ${formatCurrency(result.creditAfter)}`,
      `Allocated  : ${formatCurrency(result.allocated)}`,
      `Credit     : ${formatCurrency(result.credit)}`,
    ];

    if (result.notes?.trim()) {
      lines.push(`Notes      : ${result.notes.trim()}`);
    }

    return `${lines.join("\n")}\n`;
  };

  const buildCreditReceiptContent = (result: CreditSettlementResult) => {
    const lines = [
      "EDUCORE CREDIT SETTLEMENT",
      "==========================",
      `Credit No  : ${result.creditReceiptNo}`,
      `Student    : ${result.studentName}`,
      `Date       : ${result.date}`,
      `Credit Used: ${formatCurrency(result.creditUsed)}`,
      `Credit Left: ${formatCurrency(result.creditAfter)}`,
      "",
      "Invoices:",
      ...result.allocations.map(
        (allocation) =>
          `- ${allocation.invoiceNo ?? allocation.invoiceId}: ${formatCurrency(
            allocation.amount,
          )}`,
      ),
    ];

    return `${lines.join("\n")}\n`;
  };

  const escapeReceiptHtml = (value: string) =>
    value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const handleDownloadReceipt = (result: PaymentResult) => {
    const safeReceiptNo = result.receiptNo.replace(/[^A-Z0-9-_]/gi, "_");
    const blob = new Blob([buildReceiptContent(result)], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${safeReceiptNo || "receipt"}.txt`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    toast.success("Receipt berhasil diunduh.");
  };

  const handlePrintReceipt = (result: PaymentResult) => {
    const printWindow = window.open("", "_blank", "width=720,height=900");
    if (!printWindow) {
      toast.error("Popup print diblokir browser.");
      return;
    }
    printWindow.document.write(
      `<pre style="font: 14px/1.6 monospace; padding: 24px;">${escapeReceiptHtml(
        buildReceiptContent(result),
      )}</pre>`,
    );
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const handleDownloadCreditReceipt = (result: CreditSettlementResult) => {
    const safeReceiptNo = result.creditReceiptNo.replace(/[^A-Z0-9-_]/gi, "_");
    const blob = new Blob([buildCreditReceiptContent(result)], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${safeReceiptNo || "credit-receipt"}.txt`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    toast.success("Credit receipt berhasil diunduh.");
  };

  const handleProcessPayment = async (confirmedCredit = false) => {
    if (!allowMutation) {
      toast.info("Eksekusi pembayaran saat ini belum dibuka di runtime ini.");
      return;
    }
    if (!user?.id || !selectedStudent) return;
    if (amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    if (!selectedMethod) {
      toast.error("Pilih metode pembayaran terlebih dahulu.");
      return;
    }
    if (isDepositPayment && notes.trim().length < 3) {
      toast.error("Deposit tanpa invoice wajib menyertakan catatan.");
      return;
    }
    if (requiresCreditConfirmation && !confirmedCredit) {
      setShowConfirmDialog(true);
      return;
    }

    const requestId = crypto.randomUUID();
    const paymentNotes =
      notes.trim() ||
      (shouldUseCreditBalance
        ? `Credit/deposit digunakan: ${formatCurrency(
            Math.min(selectedStudentCreditBalance, totalOutstanding),
          )}`
        : null) ||
      (creditBalance > 0
        ? `Overpayment disimpan sebagai credit balance: ${formatCurrency(
            creditBalance,
          )}`
        : null);

    startTransition(async () => {
      try {
        const result = await processPaymentRuntimeAction(user.id, {
          studentId: selectedStudent.id,
          methodId: selectedMethod,
          amount: amount,
          date: new Date(paymentDate),
          requestId,
          useCreditBalance: shouldUseCreditBalance,
          notes: paymentNotes,
        });

        const nextResult: PaymentResult = {
          paymentNo: result.paymentNo,
          receiptNo: result.receiptNo,
          credit: result.credit,
          creditUsed: Math.min(selectedStudentCreditBalance, totalOutstanding),
          creditAfter: Math.max(
            selectedStudentCreditBalance -
              Math.min(selectedStudentCreditBalance, totalOutstanding),
            0,
          ),
          amount,
          allocated: totalAllocated,
          studentName: selectedStudent.fullName,
          methodName: selectedMethodName,
          date: paymentDate,
          notes: paymentNotes ?? undefined,
          duplicate: result.duplicate,
        };
        setPaymentResult(nextResult);
        toast.success(
          result.credit > 0
            ? `Payment processed. Credit ${formatCurrency(result.credit)} tersimpan.`
            : "Payment processed successfully.",
        );
        setAmount(0);
        setNotes("");
        setShowConfirmDialog(false);
        await loadStudentInvoices(selectedStudent.id);
        await loadOutstandingStudents();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Payment processing failed",
        );
      }
    });
  };

  const handleApplyCredit = async () => {
    if (!allowMutation) {
      toast.info("Apply credit saat ini belum dibuka di runtime ini.");
      return;
    }
    if (!user?.id || !selectedStudent) return;
    if (selectedStudentCreditBalance <= 0 || totalOutstanding <= 0) {
      toast.info("Tidak ada credit/deposit atau invoice outstanding.");
      return;
    }

    const requestId = crypto.randomUUID();
    startTransition(async () => {
      try {
        const result = await applyCreditToInvoicesRuntimeAction(user.id, {
          studentId: selectedStudent.id,
          invoiceIds: invoices.map((invoice) => invoice.id),
          amount: Math.min(selectedStudentCreditBalance, totalOutstanding),
          reason:
            notes.trim() ||
            `Apply credit/deposit untuk ${selectedStudent.fullName}`,
          requestId,
          date: new Date(paymentDate),
        });

        setCreditResult({
          ...result,
          studentName: selectedStudent.fullName,
          date: paymentDate,
        });
        setPaymentResult(null);
        setAmount(0);
        setNotes("");
        toast.success(
          `Credit applied ${formatCurrency(result.creditUsed)}. Sisa credit ${formatCurrency(result.creditAfter)}.`,
        );
        await loadStudentInvoices(selectedStudent.id);
        await loadOutstandingStudents();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Apply credit gagal.",
        );
      }
    });
  };

  return (
    <>
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="border-amber-500/30 bg-zinc-950 text-white sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black tracking-tight">
              Konfirmasi Credit Balance
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              Pembayaran ini akan menyimpan sisa dana sebagai saldo kredit
              siswa. Pastikan nominal dan catatan sudah benar sebelum lanjut.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 font-mono text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-zinc-500">Siswa</span>
              <span className="text-right font-bold text-white">
                {selectedStudent?.fullName}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-zinc-500">Nominal Bayar</span>
              <span className="font-bold text-white">
                {formatCurrency(amount)}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-zinc-500">Alokasi Invoice</span>
              <span className="font-bold text-finance-teal">
                {formatCurrency(totalAllocated)}
              </span>
            </div>
            <div className="flex justify-between gap-4 border-t border-white/10 pt-3">
              <span className="text-zinc-500">
                {isDepositPayment ? "Deposit/Credit" : "Sisa Credit"}
              </span>
              <span className="font-black text-amber-300">
                {formatCurrency(creditBalance)}
              </span>
            </div>
          </div>

          {isDepositPayment ? (
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-100">
              Siswa ini tidak punya invoice outstanding. Seluruh pembayaran akan
              masuk sebagai deposit/credit dan catatan wajib tersimpan di audit
              trail.
            </div>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
              className="border-white/10 bg-transparent text-zinc-300 hover:bg-white/10"
            >
              Review Lagi
            </Button>
            <Button
              type="button"
              onClick={() => handleProcessPayment(true)}
              disabled={isPending}
              className="bg-amber-400 font-black text-black hover:bg-amber-300"
            >
              Confirm & Execute
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 gap-6 pb-20 xl:grid-cols-5">
        <div className="space-y-6 xl:col-span-2">
          {desktopRuntime ? (
            <Card className="border-sky-500/20 bg-sky-500/10 p-5 text-sky-50 backdrop-blur-xl">
              <div className="space-y-1.5">
                <h3 className="text-sm font-bold uppercase tracking-widest text-sky-100">
                  Payment Entry Desktop Aktif
                </h3>
                <p className="text-sm text-sky-100/90">
                  Entry payment di runtime desktop sekarang memakai jalur local
                  finance. Search siswa, lookup invoice, dan submit payment
                  tidak lagi bergantung pada server action web.
                </p>
              </div>
            </Card>
          ) : null}

          {paymentResult ? (
            <Card className="space-y-4 border-emerald-500/20 bg-emerald-500/10 p-5 text-emerald-50 backdrop-blur-xl">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="text-sm font-black uppercase tracking-widest">
                    Payment Complete
                  </h3>
                  <p className="text-sm text-emerald-100/80">
                    Receipt {paymentResult.receiptNo || "-"} untuk{" "}
                    {paymentResult.studentName}
                  </p>
                </div>
                <Badge className="rounded-full bg-emerald-400 text-black">
                  {formatCurrency(paymentResult.amount)}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-3 rounded-2xl border border-emerald-400/20 bg-black/10 p-4 font-mono text-xs">
                <div>
                  <p className="uppercase tracking-widest text-emerald-100/50">
                    Payment No
                  </p>
                  <p className="font-bold text-white">
                    {paymentResult.paymentNo}
                  </p>
                </div>
                <div className="text-right">
                  <p className="uppercase tracking-widest text-emerald-100/50">
                    Cash Paid
                  </p>
                  <p className="font-bold text-white">
                    {formatCurrency(paymentResult.amount)}
                  </p>
                </div>
                <div>
                  <p className="uppercase tracking-widest text-emerald-100/50">
                    Credit Used
                  </p>
                  <p className="font-bold text-amber-200">
                    {formatCurrency(paymentResult.creditUsed)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="uppercase tracking-widest text-emerald-100/50">
                    Credit Left
                  </p>
                  <p className="font-bold text-amber-200">
                    {formatCurrency(paymentResult.creditAfter)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => handleDownloadReceipt(paymentResult)}
                  className="bg-white/10 text-white hover:bg-white/20"
                >
                  <Download className="mr-1 h-4 w-4" />
                  Download
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => handlePrintReceipt(paymentResult)}
                  className="bg-white/10 text-white hover:bg-white/20"
                >
                  <Printer className="mr-1 h-4 w-4" />
                  Print
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    setPaymentResult(null);
                    setSelectedStudent(null);
                    setInvoices([]);
                  }}
                  className="bg-finance-teal text-black hover:bg-finance-teal/90"
                >
                  <RotateCcw className="mr-1 h-4 w-4" />
                  New
                </Button>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => router.push("/dashboard/finance/invoices")}
                className="w-full border-emerald-400/20 bg-emerald-400/10 text-emerald-50 hover:bg-emerald-400/15"
              >
                View Invoice Ledger
              </Button>
            </Card>
          ) : null}

          {creditResult ? (
            <Card className="space-y-4 border-amber-500/20 bg-amber-500/10 p-5 text-amber-50 backdrop-blur-xl">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="text-sm font-black uppercase tracking-widest">
                    Credit Settlement Complete
                  </h3>
                  <p className="text-sm text-amber-100/80">
                    Credit receipt {creditResult.creditReceiptNo} untuk{" "}
                    {creditResult.studentName}
                  </p>
                </div>
                <Badge className="rounded-full bg-amber-300 text-black">
                  {formatCurrency(creditResult.creditUsed)}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-3 rounded-2xl border border-amber-400/20 bg-black/10 p-4 font-mono text-xs">
                <div>
                  <p className="uppercase tracking-widest text-amber-100/50">
                    Invoice Settled
                  </p>
                  <p className="font-bold text-white">
                    {creditResult.allocations.length}
                  </p>
                </div>
                <div className="text-right">
                  <p className="uppercase tracking-widest text-amber-100/50">
                    Credit Left
                  </p>
                  <p className="font-bold text-amber-200">
                    {formatCurrency(creditResult.creditAfter)}
                  </p>
                </div>
              </div>

              <Button
                type="button"
                size="sm"
                onClick={() => handleDownloadCreditReceipt(creditResult)}
                className="w-full bg-white/10 text-white hover:bg-white/20"
              >
                <Download className="mr-1 h-4 w-4" />
                Download Credit Receipt
              </Button>

              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setCreditResult(null);
                  setSelectedStudent(null);
                  setInvoices([]);
                }}
                className="w-full bg-amber-300 font-black text-black hover:bg-amber-200"
              >
                <RotateCcw className="mr-1 h-4 w-4" />
                New Settlement
              </Button>
            </Card>
          ) : null}

          <Card className="space-y-8 border-white/5 bg-white/5 p-6 backdrop-blur-xl shadow-2xl shadow-black/50 2xl:p-8">
            <div className="space-y-1 text-white">
              <h2 className="flex items-center gap-2 text-2xl font-bold">
                <Wallet className="h-6 w-6 text-finance-teal" />
                Entry Payment
              </h2>
              <p className="text-xs font-mono text-zinc-500 uppercase tracking-widest">
                Process student revenue
              </p>
            </div>

            <div className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-mono font-bold uppercase text-zinc-500 tracking-widest flex items-center gap-2">
                    <Users className="h-3 w-3" /> Students Belum Bayar
                  </p>
                  <Badge
                    variant="outline"
                    className="border-white/10 text-zinc-400 font-mono text-[10px] uppercase tracking-widest"
                  >
                    {displayedOutstandingStudents.length}/
                    {outstandingStudents.length} siswa
                  </Badge>
                </div>

                <div className="grid grid-cols-3 gap-1 rounded-2xl border border-white/5 bg-black/20 p-1">
                  {[
                    ["all", "Semua"],
                    ["overdue", "Overdue"],
                    ["largest", "Terbesar"],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() =>
                        setOutstandingFilter(value as OutstandingStudentFilter)
                      }
                      className={cn(
                        "rounded-xl px-3 py-2 text-[10px] font-mono font-black uppercase tracking-widest transition-colors",
                        outstandingFilter === value
                          ? "bg-finance-teal text-black"
                          : "text-zinc-500 hover:bg-white/5 hover:text-zinc-300",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="max-h-[440px] space-y-2 overflow-y-auto pr-1">
                  {isLoadingOutstanding ? (
                    <div className="rounded-2xl border border-white/5 bg-white/5 p-4 text-center text-xs font-mono uppercase tracking-widest text-zinc-500">
                      Memuat daftar tunggakan...
                    </div>
                  ) : displayedOutstandingStudents.length > 0 ? (
                    displayedOutstandingStudents.map((student) => (
                      <button
                        key={`outstanding-${student.id}`}
                        type="button"
                        onClick={() => handleSelectStudent(student)}
                        className={cn(
                          "w-full rounded-2xl border p-4 text-left transition-all 2xl:p-5",
                          selectedStudent?.id === student.id
                            ? "border-finance-teal/40 bg-finance-teal/10"
                            : "border-white/5 bg-white/5 hover:bg-white/8",
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 space-y-1">
                            <p className="font-bold text-white leading-tight">
                              {student.fullName}
                            </p>
                            <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">
                              {student.grade} | NIS: {student.nis}
                            </p>
                          </div>
                          {student.overdueCount > 0 ? (
                            <Badge
                              variant="destructive"
                              className="rounded-full px-2 py-1 text-[9px] font-mono uppercase tracking-widest"
                            >
                              {student.overdueCount} overdue
                            </Badge>
                          ) : null}
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-4 text-xs">
                          <div className="space-y-1">
                            <p className="font-mono uppercase tracking-widest text-zinc-500">
                              Outstanding
                            </p>
                            <p className="font-mono font-black text-finance-teal">
                              {formatCurrency(
                                student.netOutstanding ??
                                  Math.max(
                                    student.totalOutstanding -
                                      (student.creditBalance ?? 0),
                                    0,
                                  ),
                              )}
                            </p>
                            {(student.creditBalance ?? 0) > 0 ? (
                              <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-amber-300">
                                Credit{" "}
                                {formatCurrency(student.creditBalance ?? 0)}
                              </p>
                            ) : null}
                          </div>
                          <div className="space-y-1 text-right">
                            <p className="font-mono uppercase tracking-widest text-zinc-500">
                              Open Invoice
                            </p>
                            <p className="font-black text-white">
                              {student.invoiceCount}
                            </p>
                          </div>
                        </div>

                        {student.oldestDueDate ? (
                          <div className="mt-3 flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-zinc-500">
                            <Clock3 className="h-3 w-3" />
                            Due terlama{" "}
                            {new Date(
                              student.oldestDueDate,
                            ).toLocaleDateString()}
                          </div>
                        ) : null}
                      </button>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-white/10 bg-white/3 p-4 text-center text-xs font-mono uppercase tracking-widest text-zinc-500">
                      Tidak ada siswa pada filter ini.
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <p className="text-xs font-mono font-bold uppercase text-zinc-500 tracking-widest flex items-center gap-2">
                  <User className="h-3 w-3" /> Student Registry
                </p>
                <div className="relative group">
                  <Search
                    className={cn(
                      "absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 transition-colors",
                      isSearching
                        ? "text-finance-teal animate-pulse"
                        : "text-zinc-500",
                    )}
                  />
                  <Input
                    id="student-lookup"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Type NIS or Student Name..."
                    className="pl-11 h-12 bg-white/5 border-white/10 rounded-xl focus:ring-finance-teal/50 transition-all text-white"
                  />

                  <AnimatePresence>
                    {searchResults.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 5 }}
                        className="absolute top-full left-0 right-0 mt-2 z-50 bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-3xl"
                      >
                        {searchResults.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => handleSelectStudent(s)}
                            className="w-full p-4 flex items-center gap-4 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0"
                          >
                            <div className="h-10 w-10 rounded-full bg-finance-teal/10 flex items-center justify-center text-finance-teal font-black font-mono">
                              {s.fullName.charAt(0)}
                            </div>
                            <div className="text-left text-white">
                              <p className="font-bold leading-tight">
                                {s.fullName}
                              </p>
                              <p className="text-xs text-zinc-500 font-mono tracking-tighter uppercase">
                                {s.grade} | NIS: {s.nis}
                              </p>
                            </div>
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <AnimatePresence mode="wait">
                  {selectedStudent ? (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="p-4 rounded-2xl bg-finance-teal/10 border border-finance-teal/20 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-xl bg-finance-teal/20 flex items-center justify-center text-finance-teal text-xl font-black">
                          {selectedStudent.fullName.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-white text-lg">
                            {selectedStudent.fullName}
                          </p>
                          <p className="text-[10px] text-finance-teal/70 font-mono font-bold uppercase tracking-widest">
                            {selectedStudent.grade} | NIS: {selectedStudent.nis}
                          </p>
                          {selectedStudentCreditBalance > 0 ? (
                            <p className="mt-1 text-[10px] font-mono font-bold uppercase tracking-widest text-amber-300">
                              Credit/Deposit tersedia{" "}
                              {formatCurrency(selectedStudentCreditBalance)}
                            </p>
                          ) : null}
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedStudent(null);
                          setInvoices([]);
                        }}
                        className="text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg"
                      >
                        Change
                      </Button>
                    </motion.div>
                  ) : (
                    <div className="p-8 rounded-2xl border border-dashed border-white/5 flex flex-col items-center justify-center text-zinc-600 gap-2">
                      <User className="h-8 w-8 opacity-20" />
                      <p className="text-xs font-mono uppercase tracking-tighter font-medium">
                        Select student to start
                      </p>
                    </div>
                  )}
                </AnimatePresence>
              </div>

              <div className="space-y-4">
                <label
                  htmlFor="amount-input"
                  className="text-xs font-mono font-bold uppercase text-zinc-500 tracking-widest"
                >
                  Revenue Ingress
                </label>
                <div className="relative">
                  <span className="absolute left-6 top-1/2 -translate-y-1/2 font-mono font-black text-finance-teal text-lg">
                    IDR
                  </span>
                  <Input
                    id="amount-input"
                    type="text"
                    inputMode="numeric"
                    disabled={!selectedStudent}
                    value={amount ? formatCurrency(amount) : ""}
                    onChange={(e) =>
                      setAmount(parseRupiahInput(e.target.value))
                    }
                    className="h-16 rounded-xl border-white/10 bg-white/5 pl-20 font-mono text-2xl font-black text-white shadow-inner focus:ring-finance-teal/50"
                    placeholder="0"
                  />
                </div>
                {selectedStudent ? (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={netPayable <= 0}
                      onClick={() => setAmount(netPayable)}
                      className="border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10"
                    >
                      Pay Net Due
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setAmount(100000)}
                      className="border-amber-500/20 bg-amber-500/10 text-amber-100 hover:bg-amber-500/20"
                    >
                      Deposit 100k
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setAmount(200000)}
                      className="border-amber-500/20 bg-amber-500/10 text-amber-100 hover:bg-amber-500/20"
                    >
                      Deposit 200k
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setAmount(amount + 100000)}
                      className="border-amber-500/20 bg-amber-500/10 text-amber-100 hover:bg-amber-500/20"
                    >
                      +100k
                    </Button>
                  </div>
                ) : null}
              </div>

              <div className="space-y-4">
                <p className="text-xs font-mono font-bold uppercase text-zinc-500 tracking-widest">
                  Settlement Path
                </p>
                <div className="grid grid-cols-1 gap-2">
                  {initialMethods.map((method) => {
                    const Icon =
                      method.code === "CASH"
                        ? Banknote
                        : method.isElectronic
                          ? CreditCard
                          : Receipt;
                    return (
                      <button
                        key={method.id}
                        type="button"
                        disabled={!selectedStudent || !allowMutation}
                        onClick={() => setSelectedMethod(method.id)}
                        className={cn(
                          "flex items-center justify-between rounded-xl border p-4 transition-all duration-300 outline-none",
                          selectedMethod === method.id
                            ? "bg-finance-teal/20 border-finance-teal text-white shadow-lg shadow-finance-teal/10 translate-x-1"
                            : "bg-white/5 border-white/5 text-zinc-400 hover:bg-white/8 disabled:opacity-30 disabled:cursor-not-allowed",
                        )}
                      >
                        <div className="flex items-center gap-4">
                          <Icon
                            className={cn(
                              "h-6 w-6",
                              selectedMethod === method.id
                                ? "text-finance-teal"
                                : "text-zinc-600",
                            )}
                          />
                          <span className="font-black tracking-tight text-sm uppercase">
                            {method.name}
                          </span>
                        </div>
                        {selectedMethod === method.id && (
                          <motion.div layoutId="m-check">
                            <CheckCircle2 className="h-5 w-5 text-finance-teal" />
                          </motion.div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="date-input"
                  className="text-xs font-mono font-bold uppercase text-zinc-500 tracking-widest flex items-center gap-2"
                >
                  <Calendar className="h-3 w-3" /> Posting Date
                </label>
                <Input
                  id="date-input"
                  disabled={!selectedStudent || !allowMutation}
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="h-12 bg-white/5 border-white/10 rounded-xl text-white font-mono"
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="payment-notes"
                  className="text-xs font-mono font-bold uppercase text-zinc-500 tracking-widest"
                >
                  Notes{" "}
                  {isDepositPayment ? "(wajib untuk deposit)" : "(opsional)"}
                </label>
                <textarea
                  id="payment-notes"
                  disabled={!selectedStudent || !allowMutation}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder={
                    isDepositPayment
                      ? "Contoh: Deposit awal siswa untuk pembayaran bulan depan"
                      : "Catatan pembayaran / referensi kasir"
                  }
                  className="min-h-24 w-full resize-none rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white outline-none transition focus:ring-2 focus:ring-finance-teal/50 disabled:opacity-40"
                  maxLength={255}
                />
              </div>

              <div className="grid grid-cols-2 gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 font-mono text-xs sm:grid-cols-4">
                <div>
                  <p className="uppercase tracking-widest text-zinc-500">
                    Tagihan
                  </p>
                  <p className="font-black text-white">
                    {formatCurrency(totalOutstanding)}
                  </p>
                </div>
                <div>
                  <p className="uppercase tracking-widest text-zinc-500">
                    Credit
                  </p>
                  <p className="font-black text-amber-300">
                    {formatCurrency(selectedStudentCreditBalance)}
                  </p>
                </div>
                <div>
                  <p className="uppercase tracking-widest text-zinc-500">
                    Net Due
                  </p>
                  <p className="font-black text-finance-teal">
                    {formatCurrency(netPayable)}
                  </p>
                </div>
                <div>
                  <p className="uppercase tracking-widest text-zinc-500">
                    Cash Input
                  </p>
                  <p className="font-black text-white">
                    {formatCurrency(amount)}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-[10px] font-mono font-black uppercase tracking-widest text-zinc-500">
                      Transaction State
                    </p>
                    <p className="mt-1 text-lg font-black text-white">
                      {transactionState}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-zinc-400">
                      {primaryActionHelp}
                    </p>
                  </div>
                  <Badge
                    className={cn(
                      "w-fit rounded-full px-3 py-1 font-mono text-[10px] font-black uppercase tracking-widest",
                      isCoveredByCredit
                        ? "bg-amber-300 text-black"
                        : isDepositPayment
                          ? "bg-sky-400 text-black"
                          : creditUsedPreview > 0
                            ? "bg-finance-teal text-black"
                            : "bg-white/10 text-zinc-200",
                    )}
                  >
                    {formatCurrency(cashDuePreview)} cash due
                  </Badge>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 font-mono text-xs sm:grid-cols-4">
                  <div>
                    <p className="uppercase tracking-widest text-zinc-500">
                      Credit Used
                    </p>
                    <p className="font-black text-amber-300">
                      {formatCurrency(creditUsedPreview)}
                    </p>
                  </div>
                  <div>
                    <p className="uppercase tracking-widest text-zinc-500">
                      Cash Due
                    </p>
                    <p className="font-black text-finance-teal">
                      {formatCurrency(cashDuePreview)}
                    </p>
                  </div>
                  <div>
                    <p className="uppercase tracking-widest text-zinc-500">
                      Cash Paid
                    </p>
                    <p className="font-black text-white">
                      {formatCurrency(amount)}
                    </p>
                  </div>
                  <div>
                    <p className="uppercase tracking-widest text-zinc-500">
                      Credit Left
                    </p>
                    <p className="font-black text-amber-300">
                      {formatCurrency(
                        Math.max(
                          selectedStudentCreditBalance - creditUsedPreview,
                          0,
                        ),
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {isCoveredByCredit ? (
                <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-black uppercase tracking-widest text-amber-200 text-xs">
                        Covered by Credit
                      </p>
                      <p className="mt-1 text-sm text-amber-50/80">
                        Tagihan bisa dilunasi tanpa cash baru memakai saldo
                        deposit siswa.
                      </p>
                    </div>
                    <Badge className="bg-amber-300 text-black">
                      Net {formatCurrency(0)}
                    </Badge>
                  </div>
                  <Button
                    type="button"
                    disabled={isPending || !allowMutation}
                    onClick={handleApplyCredit}
                    className="mt-4 h-12 w-full bg-amber-300 font-black text-black hover:bg-amber-200 disabled:opacity-40"
                  >
                    {isPending ? (
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    ) : null}
                    APPLY CREDIT
                  </Button>
                </div>
              ) : null}
            </div>

            <Button
              type="button"
              disabled={!canSubmitPayment || isPending || isCoveredByCredit}
              onClick={() => handleProcessPayment(false)}
              className="flex h-14 w-full items-center justify-center gap-3 rounded-xl bg-finance-teal font-black text-lg shadow-2xl shadow-finance-teal/20 transition-transform hover:bg-finance-teal/90 active:scale-95 disabled:opacity-30"
            >
              {isPending ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <>
                  {primaryActionLabel}
                  <ArrowRight className="h-6 w-6" />
                </>
              )}
            </Button>
          </Card>
        </div>

        <div className="space-y-8 xl:col-span-3">
          <div className="flex items-center justify-between bg-white/5 p-4 border border-white/5 rounded-3xl backdrop-blur-xl">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-finance-teal/10">
                <Receipt className="h-6 w-6 text-finance-teal" />
              </div>
              <div>
                <h3 className="text-xl font-black tracking-tighter text-white">
                  Waterfall Allocation
                </h3>
                <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
                  Smart Debt Clearance Engine
                </p>
              </div>
            </div>
            <Badge
              variant="success"
              className="bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-mono tracking-widest font-black py-1.5 px-4 rounded-full"
            >
              FIFO ACTIVE
            </Badge>
          </div>

          <div className="space-y-4">
            {isLoadingInvoices ? (
              <div className="py-20 flex flex-col items-center justify-center gap-4">
                <Loader2 className="h-12 w-12 text-zinc-800 animate-spin" />
                <p className="text-xs font-mono text-zinc-600 uppercase tracking-widest animate-pulse">
                  Calculating Ledger...
                </p>
              </div>
            ) : invoices.length > 0 ? (
              <AnimatePresence mode="popLayout">
                {allocations.map((alloc, idx) => (
                  <motion.div
                    key={alloc.id}
                    initial={{ opacity: 0, x: 30 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{
                      delay: idx * 0.05,
                      type: "spring",
                      bounce: 0.3,
                    }}
                  >
                    <Card
                      className={cn(
                        "relative overflow-hidden transition-all duration-700 p-8 border-white/5 backdrop-blur-3xl rounded-[2rem]",
                        alloc.allocated > 0
                          ? "bg-finance-teal/10 ring-2 ring-finance-teal/20 shadow-2xl shadow-finance-teal/5"
                          : "bg-white/2 opacity-40 group-hover:opacity-60",
                      )}
                    >
                      <div className="relative z-10 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,auto)] xl:items-center">
                        <div className="min-w-0 space-y-2">
                          <p className="text-[10px] font-mono font-black text-zinc-500 uppercase tracking-[0.2em]">
                            {alloc.invoiceNo}
                          </p>
                          <h4 className="text-2xl font-black text-white leading-none">
                            {getAllocationTitle(alloc)}
                          </h4>
                          <div className="flex items-center gap-3">
                            <Badge
                              variant="outline"
                              className="border-white/10 text-zinc-400 font-mono text-[9px] uppercase tracking-tighter"
                            >
                              DUE:{" "}
                              {new Date(alloc.dueDate).toLocaleDateString()}
                            </Badge>
                            {alloc.outstanding > alloc.allocated &&
                              alloc.allocated > 0 && (
                                <Badge variant="warning" className="text-[9px]">
                                  PARTIAL
                                </Badge>
                              )}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-6 text-right">
                          <div className="space-y-1">
                            <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest font-black">
                              Outstanding
                            </p>
                            <p className="font-mono text-xl font-bold text-white/50">
                              {formatCurrency(alloc.outstanding)}
                            </p>
                          </div>
                          <div className="space-y-1">
                            <p
                              className={cn(
                                "text-[10px] font-mono uppercase tracking-[0.3em] font-black transition-all",
                                alloc.allocated > 0
                                  ? "text-finance-teal"
                                  : "text-zinc-600",
                              )}
                            >
                              Allocation
                            </p>
                            <div
                              className={cn(
                                "font-mono text-4xl font-black transition-all",
                                alloc.allocated > 0
                                  ? "text-finance-teal scale-110"
                                  : "text-zinc-800",
                              )}
                            >
                              {formatCurrency(alloc.allocated)}
                            </div>
                          </div>
                        </div>
                      </div>

                      <AnimatePresence>
                        {alloc.allocated > 0 && (
                          <motion.div
                            className="absolute bottom-0 left-0 right-0 h-1.5 bg-finance-teal/50"
                            initial={{ scaleX: 0, originX: 0 }}
                            animate={{
                              scaleX: alloc.allocated / alloc.outstanding,
                            }}
                            exit={{ scaleX: 0 }}
                            transition={{
                              duration: 1.5,
                              ease: [0.16, 1, 0.3, 1],
                            }}
                          />
                        )}
                      </AnimatePresence>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            ) : selectedStudent ? (
              <div className="py-24 flex flex-col items-center justify-center text-zinc-500 bg-white/3 border border-white/5 rounded-[3rem] border-dashed">
                <CheckCircle2 className="h-16 w-16 text-emerald-500/20 mb-6" />
                <p className="font-black text-2xl text-zinc-300">
                  Clean Ledger
                </p>
                <p className="font-mono text-sm uppercase tracking-widest text-zinc-600 mt-2">
                  This student has no outstanding invoices.
                </p>
              </div>
            ) : (
              <div className="py-32 flex flex-col items-center justify-center text-zinc-700 bg-white/2 border border-white/5 rounded-[3rem]">
                <Wallet className="h-20 w-20 opacity-10 mb-8" />
                <div className="space-y-4 text-center max-w-sm">
                  <p className="font-black text-3xl text-zinc-800 tracking-tighter">
                    Waiting for Entry
                  </p>
                  <p className="text-zinc-600 text-sm font-medium leading-relaxed">
                    Select a student and enter the payment amount to see the
                    intelligent FIFO allocation engine in action.
                  </p>
                </div>
              </div>
            )}

            <AnimatePresence>
              {creditBalance > 0 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="group relative p-10 rounded-[2.5rem] overflow-hidden bg-amber-500 shadow-2xl shadow-amber-500/20"
                >
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,white/20,transparent_70%)]" />
                  <div className="relative z-10 flex items-center justify-between">
                    <div className="flex items-center gap-6">
                      <div className="p-5 rounded-3xl bg-black/10 backdrop-blur-md">
                        <Info className="h-8 w-8 text-black" />
                      </div>
                      <div className="space-y-1">
                        <p className="font-black text-black text-2xl tracking-tighter">
                          Overpayment Detected
                        </p>
                        <p className="text-black/60 font-bold text-sm leading-none uppercase tracking-widest">
                          Stored as student credit balance
                        </p>
                      </div>
                    </div>
                    <div className="text-right text-black">
                      <p className="text-black/40 font-mono text-xs uppercase font-black mb-2 tracking-widest">
                        Surplus Amount
                      </p>
                      <div className="font-mono text-6xl font-black tracking-tighter leading-none">
                        {formatCurrency(creditBalance)}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </>
  );
}
