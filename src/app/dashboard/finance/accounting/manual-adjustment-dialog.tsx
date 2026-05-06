"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createManualJournalAdjustmentRuntimeAction } from "@/app/dashboard/finance/client-actions";
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

type AccountOption = {
  id: string;
  code: string;
  name: string;
  type: string;
};

type JournalLineDraft = {
  accountId: string;
  debit: number;
  credit: number;
};

const EMPTY_LINE: JournalLineDraft = {
  accountId: "",
  debit: 0,
  credit: 0,
};

export function ManualAdjustmentDialog({
  actorId,
  accounts,
  children,
}: {
  actorId: string;
  accounts: AccountOption[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [description, setDescription] = useState("");
  const [reason, setReason] = useState("");
  const [lines, setLines] = useState<JournalLineDraft[]>([
    { ...EMPTY_LINE },
    { ...EMPTY_LINE },
  ]);

  const totalDebit = lines.reduce((sum, line) => sum + line.debit, 0);
  const totalCredit = lines.reduce((sum, line) => sum + line.credit, 0);

  const updateLine = (
    index: number,
    field: keyof JournalLineDraft,
    value: string | number,
  ) => {
    setLines((current) =>
      current.map((line, lineIndex) =>
        lineIndex === index ? { ...line, [field]: value } : line,
      ),
    );
  };

  const resetForm = () => {
    setDate(new Date().toISOString().split("T")[0]);
    setDescription("");
    setReason("");
    setLines([{ ...EMPTY_LINE }, { ...EMPTY_LINE }]);
  };

  const handleSubmit = () => {
    if (!description.trim() || !reason.trim()) {
      toast.error("Deskripsi dan alasan adjustment wajib diisi.");
      return;
    }

    if (lines.some((line) => !line.accountId)) {
      toast.error("Semua baris jurnal wajib memilih akun.");
      return;
    }

    if (totalDebit !== totalCredit || totalDebit <= 0) {
      toast.error("Total debit dan kredit harus seimbang dan lebih dari nol.");
      return;
    }

    startTransition(async () => {
      try {
        await createManualJournalAdjustmentRuntimeAction(actorId, {
          date: new Date(date),
          description,
          reason,
          lines,
        });
        toast.success("Manual adjustment berhasil dibuat.");
        setOpen(false);
        resetForm();
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Gagal membuat adjustment",
        );
      }
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          resetForm();
        }
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-3xl border-white/10 bg-zinc-950 text-white">
        <DialogHeader>
          <DialogTitle>New Manual Adjustment</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="adjustment-date" className="text-sm font-medium">
                Posting Date
              </label>
              <Input
                id="adjustment-date"
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="border-white/10 bg-white/5"
              />
            </div>
            <div className="space-y-2">
              <label
                htmlFor="adjustment-description"
                className="text-sm font-medium"
              >
                Description
              </label>
              <Input
                id="adjustment-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="border-white/10 bg-white/5"
                placeholder="Contoh: Koreksi saldo kas kecil"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="adjustment-reason" className="text-sm font-medium">
              Business Reason
            </label>
            <Input
              id="adjustment-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="border-white/10 bg-white/5"
              placeholder="Jelaskan alasan adjustment untuk audit trail"
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-widest text-zinc-400">
                Journal Lines
              </h3>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setLines((current) => [...current, { ...EMPTY_LINE }])
                }
                className="border-white/10 bg-white/5"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Line
              </Button>
            </div>

            <div className="space-y-3">
              {lines.map((line, index) => (
                <div
                  key={`adjustment-line-${index + 1}`}
                  className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 md:grid-cols-[1.6fr_1fr_1fr_auto]"
                >
                  <select
                    value={line.accountId}
                    onChange={(event) =>
                      updateLine(index, "accountId", event.target.value)
                    }
                    className="rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white"
                  >
                    <option value="">Pilih akun...</option>
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.code} - {account.name}
                      </option>
                    ))}
                  </select>
                  <Input
                    type="number"
                    min={0}
                    value={line.debit || ""}
                    onChange={(event) =>
                      updateLine(index, "debit", Number(event.target.value))
                    }
                    className="border-white/10 bg-white/5"
                    placeholder="Debit"
                  />
                  <Input
                    type="number"
                    min={0}
                    value={line.credit || ""}
                    onChange={(event) =>
                      updateLine(index, "credit", Number(event.target.value))
                    }
                    className="border-white/10 bg-white/5"
                    placeholder="Credit"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={lines.length <= 2}
                    onClick={() =>
                      setLines((current) =>
                        current.filter((_, lineIndex) => lineIndex !== index),
                      )
                    }
                    className="text-rose-400 hover:bg-rose-500/10 hover:text-rose-300"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-zinc-300">
              Total debit:{" "}
              <span className="font-bold text-white">{totalDebit}</span>
              {" · "}
              Total credit:{" "}
              <span className="font-bold text-white">{totalCredit}</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            className="border-white/10 bg-white/5"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isPending}
            className="bg-finance-teal hover:bg-finance-teal/90"
          >
            Save Adjustment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
