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
import { createBatchInvoicesAction } from "@/app/dashboard/finance/actions";
import { getBillingCategoriesAction } from "@/app/dashboard/finance/queries";
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

export function BatchInvoiceModal({ children }: { children: React.ReactNode }) {
  const [step, setStep] = useState(1);
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { user } = useAuth();

  // Selection State
  const [selectedStudentIds, _setSelectedStudentIds] = useState<string[]>([]);

  // Form State
  const [batchName, setBatchName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [items, setItems] = useState([{ description: "", amount: 0 }]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>(
    [],
  );

  useEffect(() => {
    if (open) {
      void getBillingCategoriesAction().then(setCategories);
    }
  }, [open]);

  const next = () => {
    if (step === 1 && selectedStudentIds.length === 0) {
      // For now allowing "all" mode if none selected
      // toast.error("Please select at least one student");
      // return;
    }
    setStep((s) => Math.min(s + 1, 3));
  };
  const prev = () => setStep((s) => Math.max(s - 1, 1));

  const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);

  const addItem = () => setItems([...items, { description: "", amount: 0 }]);
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

  const handleFinalize = async () => {
    if (!user?.id) {
      toast.error("Sesi pengguna tidak ditemukan. Silakan login ulang.");
      return;
    }

    if (
      !batchName ||
      !categoryId ||
      !dueDate ||
      items.some((i) => !i.description || i.amount <= 0)
    ) {
      toast.error("Please complete all billing details.");
      return;
    }

    startTransition(async () => {
      try {
        const result = await createBatchInvoicesAction(user.id, {
          name: batchName,
          categoryId,
          dueDate: new Date(dueDate),
          studentIds: selectedStudentIds.length > 0 ? selectedStudentIds : [],
          items: items.map((i) => ({
            description: i.description,
            amount: i.amount,
          })),
        });

        toast.success(`Generated ${result.processed} invoices successfully.`);
        setOpen(false);
        setStep(1);
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
      <DialogContent className="max-w-3xl overflow-hidden border-white/10 bg-zinc-950 p-0 text-white backdrop-blur-3xl shadow-2xl shadow-finance-teal/20">
        <DialogHeader className="p-6 border-b border-white/5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="font-mono text-2xl font-bold tracking-tight">
                Batch <span className="text-finance-teal">Invoice</span>
              </DialogTitle>
              <p className="text-sm text-zinc-500 mt-1 uppercase tracking-widest font-medium">
                Generate mass billing in seconds
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

        <div className="p-8 min-h-[400px]">
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
                    482 Total Registered
                  </Badge>
                </div>

                <div className="rounded-xl border border-white/5 bg-white/5 p-8 text-center space-y-4">
                  <div className="p-4 rounded-full bg-finance-teal/10 w-fit mx-auto">
                    <Users className="h-10 w-10 text-finance-teal" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-zinc-200 font-bold text-lg">
                      Mass Generation Mode
                    </p>
                    <p className="text-zinc-500 text-sm max-w-sm mx-auto">
                      By default, invoices will be created for ALL active
                      students. You can use the selection tool for refined
                      targeting.
                    </p>
                  </div>
                  <div className="flex justify-center gap-3">
                    <Button
                      variant="outline"
                      className="border-white/10 bg-white/5 text-white rounded-xl"
                    >
                      All Students
                    </Button>
                    <Button
                      variant="outline"
                      disabled
                      className="border-white/5 bg-white/2 text-zinc-600 rounded-xl cursor-not-allowed"
                    >
                      Select by Class (Coming Soon)
                    </Button>
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
                <div className="grid grid-cols-2 gap-4">
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

                  <div className="space-y-3 max-h-[160px] overflow-y-auto pr-2 custom-scrollbar">
                    {items.map((item, idx) => (
                      <div
                        key={`item-${item.description}-${idx}`}
                        className="flex gap-3 items-center group"
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
                          type="number"
                          placeholder="0"
                          value={item.amount || ""}
                          onChange={(e) =>
                            updateItem(idx, "amount", Number(e.target.value))
                          }
                          className="w-40 bg-white/5 border-white/10 rounded-xl font-mono"
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
                <div className="p-6 rounded-3xl bg-finance-teal/10 ring-1 ring-finance-teal/20 space-y-6">
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

                  <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-1">
                      <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest font-bold">
                        Target
                      </p>
                      <p className="text-2xl font-black text-white">
                        {selectedStudentIds.length || "ALL"}
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

                  <div className="pt-4 border-t border-white/5 grid grid-cols-2 gap-4 text-xs font-mono">
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
                      finalizing.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <DialogFooter className="p-6 border-t border-white/5 bg-white/2">
          <div className="flex w-full justify-between items-center">
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
              <div />
            )}

            <div className="flex gap-3">
              <Button
                variant="ghost"
                onClick={() => setOpen(false)}
                className="text-zinc-400 hover:bg-white/5 rounded-xl"
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={step === 3 ? handleFinalize : next}
                disabled={isPending}
                className="bg-finance-teal hover:bg-finance-teal/90 rounded-xl shadow-lg shadow-finance-teal/20 min-w-[140px]"
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
