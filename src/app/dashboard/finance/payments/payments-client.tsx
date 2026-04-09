"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Banknote,
  Calendar,
  CheckCircle2,
  CreditCard,
  Info,
  Loader2,
  Receipt,
  Search,
  User,
  Wallet,
} from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { cn, formatCurrency } from "@/lib/utils";
import {
  getStudentInvoicesAction,
  processPaymentAction,
  searchStudentsAction,
} from "../actions";

interface StudentResult {
  id: string;
  nis: string;
  fullName: string;
  grade: string;
}

interface Invoice {
  id: string;
  invoiceNo: string;
  dueDate: string | Date;
  totalAmount: number;
  totalPaid: number;
  outstanding: number;
  studentSnapshot?: string;
}

interface PaymentMethod {
  id: string;
  code: string | null;
  name: string;
  isElectronic: boolean;
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

export function PaymentsClient({
  initialMethods,
}: {
  initialMethods: PaymentMethod[];
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
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { user } = useAuth();

  useEffect(() => {
    setPaymentDate(new Date().toISOString().split("T")[0]);
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchQuery.length >= 3) {
        setIsSearching(true);
        try {
          const results = await searchStudentsAction(searchQuery);
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
  }, [searchQuery]);

  // Fetch invoices when student selected
  const handleSelectStudent = async (student: StudentResult) => {
    setSelectedStudent(student);
    setSearchQuery("");
    setSearchResults([]);
    setIsLoadingInvoices(true);
    try {
      const data = await getStudentInvoicesAction(student.id);
      setInvoices(data as Invoice[]);
    } catch {
      toast.error("Failed to load student invoices");
    } finally {
      setIsLoadingInvoices(false);
    }
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
  const creditBalance = amount - totalAllocated;

  const handleProcessPayment = async () => {
    if (!user?.id || !selectedStudent) return;
    if (amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    startTransition(async () => {
      try {
        await processPaymentAction(user.id, {
          studentId: selectedStudent.id,
          methodId: selectedMethod,
          amount: amount,
          date: new Date(paymentDate),
          useCreditBalance: false, // Standard entry
          referenceNo: `REF-${Date.now()}`,
        });

        toast.success("Payment processed successfully");
        setAmount(0);
        setSelectedStudent(null);
        setInvoices([]);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Payment processing failed",
        );
      }
    });
  };

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-3 pb-20">
      <div className="lg:col-span-1 space-y-6">
        <Card className="border-white/5 bg-white/5 p-8 backdrop-blur-xl space-y-8 shadow-2xl shadow-black/50">
          <div className="space-y-1 text-white">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Wallet className="h-6 w-6 text-finance-teal" />
              Entry Payment
            </h2>
            <p className="text-xs font-mono text-zinc-500 uppercase tracking-widest">
              Process student revenue
            </p>
          </div>

          <div className="space-y-6">
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
                              {s.grade} • NIS: {s.nis}
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
                  type="number"
                  disabled={!selectedStudent}
                  value={amount || ""}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="pl-20 h-16 bg-white/5 border-white/10 rounded-2xl font-mono text-2xl font-black text-white focus:ring-finance-teal/50 shadow-inner"
                  placeholder="0"
                />
              </div>
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
                      disabled={!selectedStudent}
                      onClick={() => setSelectedMethod(method.id)}
                      className={cn(
                        "flex items-center justify-between p-4 rounded-2xl border transition-all duration-300 outline-none",
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
                disabled={!selectedStudent}
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="h-12 bg-white/5 border-white/10 rounded-xl text-white font-mono"
              />
            </div>
          </div>

          <Button
            type="button"
            disabled={!selectedStudent || isPending}
            onClick={handleProcessPayment}
            className="w-full h-16 bg-finance-teal hover:bg-finance-teal/90 rounded-2xl font-black text-xl shadow-2xl shadow-finance-teal/20 flex items-center justify-center gap-3 transition-transform active:scale-95 disabled:opacity-30"
          >
            {isPending ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <>
                EXECUTE PAYMENT
                <ArrowRight className="h-6 w-6" />
              </>
            )}
          </Button>
        </Card>
      </div>

      <div className="lg:col-span-2 space-y-8">
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
                    <div className="flex items-center justify-between relative z-10">
                      <div className="space-y-2">
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
                            DUE: {new Date(alloc.dueDate).toLocaleDateString()}
                          </Badge>
                          {alloc.outstanding > alloc.allocated &&
                            alloc.allocated > 0 && (
                              <Badge variant="warning" className="text-[9px]">
                                PARTIAL
                              </Badge>
                            )}
                        </div>
                      </div>

                      <div className="flex items-center gap-12 text-right">
                        <div className="space-y-1">
                          <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest font-black">
                            Outstanding
                          </p>
                          <p className="font-mono text-xl font-bold text-white/50">
                            {formatCurrency(alloc.outstanding)}
                          </p>
                        </div>
                        <div
                          className={cn(
                            "w-px h-16 transition-colors",
                            alloc.allocated > 0
                              ? "bg-finance-teal/50"
                              : "bg-white/5",
                          )}
                        />
                        <div className="space-y-1 ml-4 min-w-[200px]">
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
              <p className="font-black text-2xl text-zinc-300">Clean Ledger</p>
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
  );
}
