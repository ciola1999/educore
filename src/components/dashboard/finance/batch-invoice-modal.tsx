"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileText,
  History as HistoryIcon,
  Loader2,
  PlusCircle,
  Trash2,
  Users,
} from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  createBatchInvoicesRuntimeAction,
  getBatchStudentCandidatesRuntimeAction,
  getBillingCategoriesRuntimeAction,
} from "@/app/dashboard/finance/client-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { cn, formatCurrency } from "@/lib/utils";

const steps = [
  { id: 1, name: "Select Students", icon: Users },
  { id: 2, name: "Plan Billing", icon: FileText },
  { id: 3, name: "Review & Generate", icon: HistoryIcon },
];

type BatchInvoiceItem = {
  id: string;
  description: string;
  amount: number;
};

type BatchStudentCandidate = {
  id: string;
  nis: string;
  nisn: string | null;
  fullName: string;
  grade: string;
  hasExistingInvoiceForPeriod: boolean;
};

type BatchTargetMode = "ALL_STUDENTS" | "SELECTED_STUDENTS";

function createEmptyBatchInvoiceItem(): BatchInvoiceItem {
  return {
    id: crypto.randomUUID(),
    description: "",
    amount: 0,
  };
}

function parseRupiahInput(value: string) {
  const digitsOnly = value.replace(/\D/g, "");
  return digitsOnly ? Number(digitsOnly) : 0;
}

export function BatchInvoiceModal({
  children,
  defaultOpen = false,
}: {
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [step, setStep] = useState(1);
  const [open, setOpen] = useState(defaultOpen);
  const [isPending, startTransition] = useTransition();
  const { user } = useAuth();

  // Selection State
  const [targetMode, setTargetMode] = useState<BatchTargetMode>("ALL_STUDENTS");
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [studentSearch, setStudentSearch] = useState("");
  const [studentCandidates, setStudentCandidates] = useState<
    BatchStudentCandidate[]
  >([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);

  // Form State
  const [batchName, setBatchName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [items, setItems] = useState<BatchInvoiceItem[]>([
    createEmptyBatchInvoiceItem(),
  ]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>(
    [],
  );

  useEffect(() => {
    if (open) {
      void getBillingCategoriesRuntimeAction().then(setCategories);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      setIsLoadingStudents(true);
      try {
        const candidates = await getBatchStudentCandidatesRuntimeAction({
          query: studentSearch,
          limit: 100,
          categoryId: categoryId || undefined,
          dueDate: dueDate ? new Date(dueDate) : undefined,
        });
        if (!cancelled) {
          setStudentCandidates(candidates);
        }
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          toast.error("Gagal memuat daftar peserta didik.");
        }
      } finally {
        if (!cancelled) {
          setIsLoadingStudents(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [categoryId, dueDate, open, studentSearch]);

  const next = () => {
    if (
      step === 1 &&
      targetMode === "SELECTED_STUDENTS" &&
      selectedStudentIds.length === 0
    ) {
      toast.error("Minimal pilih 1 peserta didik.");
      return;
    }
    setStep((s) => Math.min(s + 1, 3));
  };
  const prev = () => setStep((s) => Math.max(s - 1, 1));

  const normalizedItems = items.map((item) => ({
    ...item,
    description: item.description.trim(),
    amount: Math.trunc(item.amount),
  }));
  const totalAmount = normalizedItems.reduce(
    (sum, item) => sum + item.amount,
    0,
  );
  const isMassGenerationMode = targetMode === "ALL_STUDENTS";
  const selectedStudents = studentCandidates.filter((student) =>
    selectedStudentIds.includes(student.id),
  );
  const targetLabel =
    targetMode === "ALL_STUDENTS"
      ? "ALL"
      : selectedStudentIds.length.toString();

  const addItem = () => setItems([...items, createEmptyBatchInvoiceItem()]);
  const removeItem = (idx: number) =>
    setItems(items.filter((_, i) => i !== idx));
  const updateItem = (
    idx: number,
    field: "description" | "amount",
    value: string | number,
  ) => {
    const newItems = [...items];
    newItems[idx] = { ...newItems[idx], [field]: value };
    setItems(newItems);
  };
  const toggleStudent = (studentId: string) => {
    setSelectedStudentIds((current) =>
      current.includes(studentId)
        ? current.filter((id) => id !== studentId)
        : [...current, studentId],
    );
  };

  const handleFinalize = async () => {
    if (!user?.id) {
      toast.error("Sesi pengguna tidak ditemukan. Silakan login ulang.");
      return;
    }

    if (
      !batchName ||
      !categoryId ||
      !dueDate ||
      normalizedItems.some((i) => !i.description || i.amount < 1000)
    ) {
      toast.error(
        "Lengkapi detail billing. Nominal item invoice minimal Rp1.000.",
      );
      return;
    }

    if (
      isMassGenerationMode &&
      !window.confirm(
        "Batch invoice ini akan diproses untuk semua siswa aktif. Di desktop proses ini bisa memakan waktu lebih lama. Lanjutkan?",
      )
    ) {
      return;
    }

    startTransition(async () => {
      try {
        const result = await createBatchInvoicesRuntimeAction(user.id, {
          name: batchName,
          categoryId,
          dueDate: new Date(dueDate),
          targetMode,
          studentIds: selectedStudentIds.length > 0 ? selectedStudentIds : [],
          items: normalizedItems.map((i) => ({
            description: i.description,
            amount: i.amount,
          })),
        });

        toast.success(
          `Generated ${result.processed} invoices. Skipped ${result.skipped ?? 0}.`,
        );
        setOpen(false);
        setStep(1);
        setTargetMode("ALL_STUDENTS");
        setSelectedStudentIds([]);
        setStudentSearch("");
        setBatchName("");
        setCategoryId("");
        setDueDate("");
        setItems([createEmptyBatchInvoiceItem()]);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to generate batch",
        );
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="flex max-h-[min(46rem,calc(100dvh-1rem))] w-[calc(100vw-1rem)] max-w-3xl flex-col overflow-hidden border-white/10 bg-zinc-950 p-0 text-white backdrop-blur-3xl shadow-2xl shadow-finance-teal/20 sm:w-[calc(100vw-2rem)]">
        <DialogHeader className="shrink-0 space-y-4 border-b border-white/5 p-4 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <DialogTitle className="font-mono text-xl font-bold tracking-tight sm:text-2xl">
                Batch <span className="text-finance-teal">Invoice</span>
              </DialogTitle>
              <p className="mt-1 text-xs font-medium uppercase tracking-widest text-zinc-500 sm:text-sm">
                Generate batch billing for desktop finance runtime
              </p>
            </div>
            <div className="flex items-center gap-2">
              {steps.map((s) => (
                <div
                  key={s.id}
                  className={cn(
                    "h-1.5 w-8 rounded-full transition-all duration-300",
                    step >= s.id ? "bg-finance-teal" : "bg-zinc-800",
                  )}
                />
              ))}
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-8 sm:py-6">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <Users className="h-5 w-5 text-finance-teal" />
                    Target Students
                  </h3>
                  <Badge
                    variant="outline"
                    className="border-white/10 text-white"
                  >
                    {targetMode === "ALL_STUDENTS"
                      ? `${studentCandidates.length} shown`
                      : `${selectedStudentIds.length} selected`}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 rounded-xl border border-white/5 bg-black/20 p-1">
                  <button
                    type="button"
                    onClick={() => setTargetMode("ALL_STUDENTS")}
                    className={cn(
                      "rounded-lg px-4 py-3 text-sm font-black transition-colors",
                      targetMode === "ALL_STUDENTS"
                        ? "bg-finance-teal text-black"
                        : "text-zinc-400 hover:bg-white/5 hover:text-white",
                    )}
                  >
                    All Students
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetMode("SELECTED_STUDENTS")}
                    className={cn(
                      "rounded-lg px-4 py-3 text-sm font-black transition-colors",
                      targetMode === "SELECTED_STUDENTS"
                        ? "bg-finance-teal text-black"
                        : "text-zinc-400 hover:bg-white/5 hover:text-white",
                    )}
                  >
                    Pilih Manual
                  </button>
                </div>

                <div className="space-y-3">
                  <Input
                    value={studentSearch}
                    onChange={(event) => setStudentSearch(event.target.value)}
                    placeholder="Cari nama, NIS, NISN, atau kelas..."
                    className="h-12 rounded-xl border-white/10 bg-white/5 text-white"
                  />

                  {selectedStudentIds.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {selectedStudents.map((student) => (
                        <button
                          key={`selected-${student.id}`}
                          type="button"
                          onClick={() => toggleStudent(student.id)}
                          className="rounded-full border border-finance-teal/30 bg-finance-teal/10 px-3 py-1 text-xs font-bold text-finance-teal"
                        >
                          {student.fullName}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="max-h-[min(18rem,38dvh)] space-y-2 overflow-y-auto pr-1">
                    {isLoadingStudents ? (
                      <div className="flex h-40 items-center justify-center rounded-xl border border-white/5 bg-white/5">
                        <Loader2 className="h-7 w-7 animate-spin text-finance-teal" />
                      </div>
                    ) : studentCandidates.length > 0 ? (
                      studentCandidates.map((student) => {
                        const isSelected = selectedStudentIds.includes(
                          student.id,
                        );
                        return (
                          <button
                            key={student.id}
                            type="button"
                            onClick={() => {
                              setTargetMode("SELECTED_STUDENTS");
                              toggleStudent(student.id);
                            }}
                            className={cn(
                              "flex w-full items-center justify-between gap-4 rounded-xl border p-4 text-left transition-colors",
                              isSelected
                                ? "border-finance-teal/40 bg-finance-teal/10"
                                : "border-white/5 bg-white/5 hover:bg-white/8",
                            )}
                          >
                            <div className="min-w-0">
                              <p className="truncate font-bold text-white">
                                {student.fullName}
                              </p>
                              <p className="truncate font-mono text-[10px] uppercase tracking-widest text-zinc-500">
                                {student.grade} | NIS: {student.nis}
                                {student.nisn ? ` | NISN: ${student.nisn}` : ""}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              {student.hasExistingInvoiceForPeriod && (
                                <Badge variant="warning" className="text-[9px]">
                                  EXISTING
                                </Badge>
                              )}
                              <Badge
                                variant={isSelected ? "success" : "outline"}
                                className="font-mono text-[9px]"
                              >
                                {isSelected ? "SELECTED" : "ADD"}
                              </Badge>
                            </div>
                          </button>
                        );
                      })
                    ) : (
                      <div className="rounded-xl border border-dashed border-white/10 bg-white/3 p-8 text-center text-sm text-zinc-500">
                        Peserta didik tidak ditemukan.
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label
                      htmlFor="batch-name"
                      className="text-xs font-mono font-bold uppercase text-zinc-500 tracking-widest"
                    >
                      Batch Name
                    </label>
                    <Input
                      id="batch-name"
                      value={batchName}
                      onChange={(e) => setBatchName(e.target.value)}
                      placeholder="e.g. SPP April 2026"
                      className="bg-white/5 border-white/10 rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <label
                      htmlFor="category-id"
                      className="text-xs font-mono font-bold uppercase text-zinc-500 tracking-widest"
                    >
                      Billing Category
                    </label>
                    <select
                      id="category-id"
                      value={categoryId}
                      onChange={(e) => setCategoryId(e.target.value)}
                      className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-sm focus:ring-1 focus:ring-finance-teal outline-none"
                    >
                      <option value="">Select Category...</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label
                      htmlFor="due-date"
                      className="text-xs font-mono font-bold uppercase text-zinc-500 tracking-widest"
                    >
                      Due Date
                    </label>
                    <Input
                      id="due-date"
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="bg-white/5 border-white/10 rounded-xl"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-mono font-bold uppercase text-zinc-500 tracking-widest">
                      Line Items
                    </h4>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-finance-teal hover:bg-finance-teal/10 rounded-lg"
                      onClick={addItem}
                    >
                      <PlusCircle className="h-3 w-3 mr-1" />
                      Add Item
                    </Button>
                  </div>

                  <div className="max-h-[min(13rem,30dvh)] space-y-3 overflow-y-auto pr-2 custom-scrollbar">
                    {items.map((item, idx) => (
                      <div
                        key={item.id}
                        className="group flex flex-col gap-3 sm:flex-row sm:items-center"
                      >
                        <Input
                          placeholder="Description (e.g. SPP Bulanan)"
                          value={item.description}
                          onChange={(e) =>
                            updateItem(idx, "description", e.target.value)
                          }
                          className="flex-1 bg-white/5 border-white/10 rounded-xl"
                        />
                        <Input
                          type="text"
                          inputMode="numeric"
                          placeholder="0"
                          value={item.amount ? formatCurrency(item.amount) : ""}
                          onChange={(e) =>
                            updateItem(
                              idx,
                              "amount",
                              parseRupiahInput(e.target.value),
                            )
                          }
                          className="w-full rounded-xl border-white/10 bg-white/5 font-mono sm:w-40"
                        />
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-10 w-10 text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-500/10 rounded-xl shrink-0"
                          onClick={() => removeItem(idx)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-6 py-4"
              >
                <div className="space-y-6 rounded-3xl bg-finance-teal/10 p-4 ring-1 ring-finance-teal/20 sm:p-6">
                  <div className="flex items-center justify-between pb-4 border-b border-white/5">
                    <div className="flex items-center gap-2">
                      <HistoryIcon className="h-4 w-4 text-finance-teal" />
                      <span className="text-sm font-mono text-zinc-400 font-bold">
                        Execution Plan
                      </span>
                    </div>
                    <Badge
                      variant="outline"
                      className="border-finance-teal/40 text-finance-teal font-mono"
                    >
                      READY
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-8">
                    <div className="space-y-1">
                      <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest font-bold">
                        Target
                      </p>
                      <p className="text-2xl font-black text-white">
                        {targetLabel}
                        <span className="text-sm font-medium text-zinc-500 ml-2">
                          Students
                        </span>
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest font-bold">
                        Invoice Value
                      </p>
                      <p className="text-2xl font-black text-finance-teal">
                        {formatCurrency(totalAmount)}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 border-t border-white/5 pt-4 font-mono text-xs sm:grid-cols-2 sm:gap-4">
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Category:</span>
                      <span className="text-white font-bold">
                        {categories.find((c) => c.id === categoryId)?.name ||
                          "None"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Due Date:</span>
                      <span className="text-white font-bold">
                        {dueDate || "Not Set"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 flex gap-4 items-start">
                  <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-amber-200">
                      Pre-execution Warning
                    </p>
                    <p className="text-xs text-amber-200/60 leading-relaxed">
                      Generated invoices will be immutable. Auto-deletion is not
                      supported. Please verify the amounts and students before
                      finalizing. Jika target masih ALL active students, proses
                      bisa berjalan lebih lama dari aksi finance biasa.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <DialogFooter className="shrink-0 border-t border-white/5 bg-white/2 p-4 sm:p-6">
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {step > 1 ? (
              <Button
                variant="ghost"
                onClick={prev}
                className="text-zinc-400 hover:text-white rounded-xl"
                disabled={isPending}
              >
                <ChevronLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            ) : (
              <div className="hidden sm:block" />
            )}

            <div className="flex w-full flex-col-reverse gap-3 sm:w-auto sm:flex-row">
              <Button
                variant="ghost"
                onClick={() => setOpen(false)}
                className="rounded-xl text-zinc-400 hover:bg-white/5"
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={step === 3 ? handleFinalize : next}
                disabled={isPending}
                className="min-w-[140px] rounded-xl bg-finance-teal shadow-lg shadow-finance-teal/20 hover:bg-finance-teal/90"
              >
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    {step === 3 ? "Finalize Generation" : "Continue"}
                    {step < 3 && <ChevronRight className="ml-2 h-4 w-4" />}
                    {step === 3 && <CheckCircle2 className="ml-2 h-4 w-4" />}
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function BatchInvoiceModalAutoOpen() {
  return (
    <BatchInvoiceModal defaultOpen>
      <button type="button" className="hidden" aria-hidden="true" tabIndex={-1}>
        Open batch invoice
      </button>
    </BatchInvoiceModal>
  );
}
