"use client";

import { processQRScan, type ScanResult } from "@/lib/services/attendance";
import { AnimatePresence, motion } from "framer-motion";
import { Html5QrcodeScanner } from "html5-qrcode";
import { CheckCircle2, Loader2, Scan, User, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export function QRScannerView() {
	const [result, setResult] = useState<ScanResult | null>(null);
	const [processing, setProcessing] = useState(false);

	useEffect(() => {
		const scanner = new Html5QrcodeScanner(
			"reader",
			{ fps: 10, qrbox: { width: 300, height: 300 } },
			false,
		);

		scanner.render(
			async (decodedText) => {
				if (processing) return;
				setProcessing(true);
				try {
					const res = await processQRScan(decodedText);
					setResult(res);
					if (res.success) {
						toast.success(res.message);
					} else {
						toast.error(res.message);
					}
				} catch (err) {
					toast.error("Terjadi kesalahan sistem");
				} finally {
					setProcessing(false);
					// Clear result after 5 seconds
					setTimeout(() => setResult(null), 5000);
				}
			},
			() => {
				if (processing) return;
			},
		);

		return () => {
			scanner.clear().catch(console.error);
		};
	}, [processing]);

	return (
		<div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start py-6">
			{/* Scanner UI */}
			<div className="space-y-6">
				<div className="relative rounded-3xl overflow-hidden border-2 border-zinc-800 shadow-2xl bg-black aspect-square max-w-[500px] mx-auto group">
					<div id="reader" className="w-full h-full scale-[1.02]"></div>

					{/* Scanner Overlay Decor */}
					<div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
						<div className="w-64 h-64 border-2 border-blue-500/50 rounded-2xl animate-pulse relative">
							<div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-1 bg-linear-to-r from-transparent via-blue-400 to-transparent animate-scan"></div>
						</div>
					</div>

					{processing && (
						<div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm flex flex-col items-center justify-center z-50 animate-in fade-in duration-300">
							<Loader2 className="h-12 w-12 animate-spin text-blue-500 mb-4" />
							<p className="text-zinc-400 font-bold uppercase tracking-widest text-sm">
								Memproses Data...
							</p>
						</div>
					)}
				</div>
				<div className="flex items-center gap-3 justify-center text-zinc-500">
					<Scan className="h-5 w-5" />
					<p className="text-sm font-medium">
						Arahkan QR Code ke kamera untuk melakukan absen
					</p>
				</div>
			</div>

			{/* Feedback Display */}
			<div className="min-h-[500px] flex flex-col items-center justify-center">
				<AnimatePresence mode="wait">
					{!result ? (
						<motion.div
							key="idle"
							initial={{ opacity: 0, scale: 0.9 }}
							animate={{ opacity: 1, scale: 1 }}
							exit={{ opacity: 0, scale: 1.1 }}
							className="text-center space-y-8 max-w-sm"
						>
							<div className="w-48 h-48 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto opacity-20">
								<Scan className="h-24 w-24 text-zinc-400" />
							</div>
							<div className="space-y-4">
								<h2 className="text-3xl font-bold text-zinc-700">
									Ready to Scan
								</h2>
								<p className="text-zinc-500 text-lg">
									System is active. Please present student or staff ID card.
								</p>
							</div>
						</motion.div>
					) : (
						<motion.div
							key="result"
							initial={{ opacity: 0, y: 40 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, scale: 0.9 }}
							className={`w-full max-w-md p-10 rounded-[2.5rem] border shadow-3xl text-center relative overflow-hidden ${
								result.success
									? "bg-zinc-900 border-emerald-500/30 ring-1 ring-emerald-500/10"
									: "bg-zinc-900 border-red-500/30 ring-1 ring-red-500/10"
							}`}
						>
							{/* Result Header Icon */}
							<div className="absolute top-0 right-0 p-8 opacity-10">
								{result.success ? (
									<CheckCircle2 className="h-32 w-32" />
								) : (
									<XCircle className="h-32 w-32" />
								)}
							</div>

							<div className="space-y-10 relative z-10">
								{/* Avatar/Photo Placeholder */}
								<div className="relative mx-auto w-32 h-32">
									<div
										className={`w-32 h-32 rounded-3xl overflow-hidden border-4 shadow-2xl p-1 ${result.success ? "border-emerald-500 bg-emerald-500/20" : "border-red-500 bg-red-500/20"}`}
									>
										<div className="w-full h-full rounded-[1.25rem] bg-zinc-800 flex items-center justify-center overflow-hidden">
											{result.data?.photo ? (
												<div
													className="w-full h-full bg-cover bg-center"
													style={{
														backgroundImage: `url(${result.data.photo})`,
													}}
												/>
											) : (
												<User
													className={`h-16 w-16 ${result.success ? "text-emerald-400" : "text-red-400"}`}
												/>
											)}
										</div>
									</div>
									<div
										className={`absolute -bottom-3 -right-3 p-3 rounded-2xl shadow-xl ${result.success ? "bg-emerald-500 text-white" : "bg-red-500 text-white"}`}
									>
										{result.success ? (
											<CheckCircle2 className="h-6 w-6" />
										) : (
											<XCircle className="h-6 w-6" />
										)}
									</div>
								</div>

								<div className="space-y-3">
									<div className="space-y-1">
										<p className="text-zinc-400 font-mono text-sm uppercase tracking-widest">
											{result.data?.nis || result.data?.type}
										</p>
										<h2 className="text-4xl font-extrabold text-white tracking-tight">
											{result.data?.fullName || "UNKNOWN"}
										</h2>
									</div>
									<div
										className={`inline-flex px-5 py-2 rounded-2xl font-bold uppercase tracking-widest text-sm shadow-sm ${
											result.data?.status === "on-time"
												? "bg-emerald-500/10 text-emerald-400"
												: "bg-orange-500/10 text-orange-400"
										}`}
									>
										{result.data?.status ||
											(result.success ? "Success" : "Failed")}
									</div>
								</div>

								<div className="grid grid-cols-2 gap-4 border-t border-zinc-800/80 pt-8">
									<div className="space-y-1 text-left">
										<p className="text-zinc-400 text-xs font-bold uppercase tracking-tighter">
											Scan Time
										</p>
										<p className="text-xl font-mono text-white font-bold">
											{result.data?.time || "--:--"}
										</p>
									</div>
									{result.data?.lateMinutes && result.data.lateMinutes > 0 && (
										<div className="space-y-1 text-right">
											<p className="text-red-500/80 text-xs font-bold uppercase tracking-tighter">
												Late Duration
											</p>
											<p className="text-xl font-mono text-red-400 font-bold">
												{result.data.lateMinutes}m
											</p>
										</div>
									)}
								</div>

								<div
									className={`p-4 rounded-2xl text-lg font-bold ${result.success ? "bg-emerald-600 text-white" : "bg-red-600 text-white"}`}
								>
									{result.message}
								</div>
							</div>
						</motion.div>
					)}
				</AnimatePresence>
			</div>
		</div>
	);
}
