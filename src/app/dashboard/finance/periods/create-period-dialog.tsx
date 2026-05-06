"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createFinancePeriodRuntimeAction } from "@/app/dashboard/finance/client-actions";
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

export function CreatePeriodDialog({
  actorId,
  children,
}: {
  actorId: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const resetForm = () => {
    setName("");
    setStartDate("");
    setEndDate("");
  };

  const handleSubmit = () => {
    if (!name.trim() || !startDate || !endDate) {
      toast.error("Nama, tanggal mulai, dan tanggal akhir wajib diisi.");
      return;
    }

    startTransition(async () => {
      try {
        await createFinancePeriodRuntimeAction(actorId, {
          name,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
        });
        toast.success("Periode keuangan berhasil dibuat.");
        setOpen(false);
        resetForm();
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Gagal membuat periode",
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
      <DialogContent className="max-w-lg border-white/10 bg-zinc-950 text-white">
        <DialogHeader>
          <DialogTitle>Create Finance Period</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="period-name" className="text-sm font-medium">
              Period Name
            </label>
            <Input
              id="period-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="border-white/10 bg-white/5"
              placeholder="Contoh: Q3 2026"
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="period-start" className="text-sm font-medium">
                Start Date
              </label>
              <Input
                id="period-start"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                className="border-white/10 bg-white/5"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="period-end" className="text-sm font-medium">
                End Date
              </label>
              <Input
                id="period-end"
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                className="border-white/10 bg-white/5"
              />
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
            Save Period
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
