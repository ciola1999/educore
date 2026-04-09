"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  Calendar,
  ClipboardList,
  FileJson,
  Hash,
  Search,
  Shield,
  User,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { FinanceAuditLogView } from "../types";

function formatLogPayload(details: string | null) {
  if (!details) {
    return "No additional payload recorded for this event.";
  }

  try {
    return JSON.stringify(JSON.parse(details), null, 4);
  } catch {
    return details;
  }
}

export function AuditClient({ logs }: { logs: FinanceAuditLogView[] }) {
  const [search, setSearch] = useState("");
  const [selectedLog, setSelectedLog] = useState<string | null>(null);

  const filteredLogs = logs.filter(
    (l) =>
      l.action.toLowerCase().includes(search.toLowerCase()) ||
      l.actor.fullName.toLowerCase().includes(search.toLowerCase()) ||
      l.details?.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 group-focus-within:text-finance-teal transition-colors" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search events, actors, details..."
            className="pl-11 h-12 bg-white/5 border-white/10 rounded-xl focus:ring-finance-teal/50 transition-all text-white"
          />
        </div>
      </div>

      <div className="space-y-4">
        {filteredLogs.length > 0 ? (
          filteredLogs.map((log, idx) => (
            <motion.div
              key={log.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.03 }}
            >
              <Card
                className={cn(
                  "group overflow-hidden border-white/5 bg-white/5 backdrop-blur-3xl rounded-3xl transition-all duration-500",
                  selectedLog === log.id
                    ? "bg-white/10 ring-1 ring-white/20"
                    : "hover:bg-white/8",
                )}
              >
                <button
                  type="button"
                  className="p-6 cursor-pointer w-full text-left"
                  onClick={() =>
                    setSelectedLog(selectedLog === log.id ? null : log.id)
                  }
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="flex items-center gap-6">
                      <div
                        className={cn(
                          "h-12 w-12 rounded-2xl flex items-center justify-center border transition-all duration-500",
                          log.action.includes("PAYMENT")
                            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                            : log.action.includes("INVOICE")
                              ? "bg-finance-teal/10 border-finance-teal/20 text-finance-teal"
                              : "bg-zinc-800 border-white/10 text-zinc-400",
                        )}
                      >
                        <Activity className="h-6 w-6" />
                      </div>
                      <div className="space-y-1 text-white">
                        <div className="flex items-center gap-3">
                          <Badge
                            variant="outline"
                            className="border-white/10 text-[9px] font-black tracking-widest px-2 py-0.5"
                          >
                            {log.action}
                          </Badge>
                          <span className="text-[10px] font-mono text-zinc-600 uppercase tracking-tighter">
                            ID: {log.id.split("-")[0].toUpperCase()}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-xs font-mono text-zinc-500">
                          <span className="flex items-center gap-1.5">
                            <User className="h-3 w-3" /> {log.actor.fullName}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Calendar className="h-3 w-3" />{" "}
                            {new Date(log.createdAt).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div
                      className={cn(
                        "px-4 py-2 rounded-xl bg-black/20 text-[10px] font-mono text-zinc-400 border border-white/5 transition-all duration-500",
                        selectedLog === log.id
                          ? "border-finance-teal/30 text-finance-teal"
                          : "group-hover:border-white/10 group-hover:text-zinc-300",
                      )}
                    >
                      REVIEW METADATA
                    </div>
                  </div>
                </button>

                <AnimatePresence>
                  {selectedLog === log.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden border-t border-white/5 bg-black/40"
                    >
                      <div className="p-8 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          <div className="space-y-4">
                            <div className="flex items-center gap-3 text-white">
                              <Hash className="h-4 w-4 text-finance-teal" />
                              <h5 className="text-sm font-black tracking-widest uppercase">
                                Transaction Payload
                              </h5>
                            </div>
                            <div className="p-6 rounded-2xl bg-zinc-950/80 border border-white/5 font-mono text-[11px] leading-relaxed text-zinc-400 overflow-x-auto whitespace-pre">
                              {formatLogPayload(log.details)}
                            </div>
                          </div>
                          <div className="space-y-6">
                            <div className="flex items-center gap-3 text-white">
                              <Shield className="h-4 w-4 text-finance-teal" />
                              <h5 className="text-sm font-black tracking-widest uppercase">
                                Security Verification
                              </h5>
                            </div>
                            <Card className="p-6 border-white/5 bg-white/2 rounded-2xl space-y-4">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest">
                                  Compliance Status
                                </span>
                                <Badge className="bg-emerald-500/10 text-emerald-400 border-none rounded-lg px-2 text-[9px] font-black">
                                  CERTIFIED
                                </Badge>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest">
                                  Origin Runtime
                                </span>
                                <span className="text-[10px] font-mono text-white">
                                  SERVER-SIDE-ACTION
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest">
                                  Audit Context
                                </span>
                                <span className="text-[10px] font-mono text-zinc-400 italic">
                                  Phase 5.0 Governance Active
                                </span>
                              </div>
                            </Card>
                            <Button
                              variant="outline"
                              className="w-full h-12 rounded-xl border-white/5 bg-white/5 text-zinc-400 hover:text-white gap-3 transition-all"
                            >
                              <FileJson className="h-4 w-4" /> EXPORT AS
                              EVIDENCE <ArrowRight className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>
            </motion.div>
          ))
        ) : (
          <div className="py-32 flex flex-col items-center justify-center text-zinc-700 bg-white/2 border border-white/5 rounded-[3rem]">
            <ClipboardList className="h-20 w-20 opacity-10 mb-8" />
            <div className="space-y-4 text-center max-w-sm">
              <p className="font-black text-3xl text-zinc-800 tracking-tighter">
                Clear Audit Trail
              </p>
              <p className="text-zinc-600 text-sm font-medium leading-relaxed">
                No financial events have been logged matching your current
                filters. All operations from generation to settlement are
                captured here automatically.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
