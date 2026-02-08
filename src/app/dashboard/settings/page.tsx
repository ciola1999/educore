"use client";

import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	fullSync,
	pullFromSupabase,
	pushToSupabase,
	type SyncResult,
} from "@/lib/supabase/sync";
import {
	CheckCircle,
	Cloud,
	CloudDownload,
	CloudUpload,
	Loader2,
	RefreshCw,
	XCircle,
} from "lucide-react";
import { useState } from "react";

export default function SettingsPage() {
	const [syncing, setSyncing] = useState(false);
	const [lastResult, setLastResult] = useState<SyncResult | null>(null);

	async function handleFullSync() {
		setSyncing(true);
		setLastResult(null);
		try {
			const result = await fullSync();
			setLastResult(result);
		} catch {
			setLastResult({ status: "error", message: "Sync failed unexpectedly" });
		} finally {
			setSyncing(false);
		}
	}

	async function handlePush() {
		setSyncing(true);
		setLastResult(null);
		try {
			const result = await pushToSupabase();
			setLastResult(result);
		} catch {
			setLastResult({ status: "error", message: "Push failed" });
		} finally {
			setSyncing(false);
		}
	}

	async function handlePull() {
		setSyncing(true);
		setLastResult(null);
		try {
			const result = await pullFromSupabase();
			setLastResult(result);
		} catch {
			setLastResult({ status: "error", message: "Pull failed" });
		} finally {
			setSyncing(false);
		}
	}

	return (
		<div className="space-y-6">
			<div>
				<h2 className="text-3xl font-bold tracking-tight bg-linear-to-r from-gray-300 to-gray-500 bg-clip-text text-transparent">
					Settings
				</h2>
				<p className="text-zinc-400 mt-1">
					Manage application settings and data synchronization.
				</p>
			</div>

			<div className="grid gap-6 md:grid-cols-2">
				{/* Sync Card */}
				<Card className="bg-zinc-900 border-zinc-800 text-white col-span-2">
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Cloud className="h-5 w-5 text-blue-400" />
							Cloud Sync (Supabase)
						</CardTitle>
						<CardDescription className="text-zinc-400">
							Synchronize local data with cloud database. Uses Last-Write-Wins
							strategy.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="flex flex-wrap gap-3">
							<Button
								onClick={handleFullSync}
								disabled={syncing}
								className="bg-blue-600 hover:bg-blue-500 gap-2"
							>
								{syncing ? (
									<Loader2 className="h-4 w-4 animate-spin" />
								) : (
									<RefreshCw className="h-4 w-4" />
								)}
								Full Sync
							</Button>
							<Button
								onClick={handlePush}
								disabled={syncing}
								variant="outline"
								className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 gap-2"
							>
								<CloudUpload className="h-4 w-4" />
								Push to Cloud
							</Button>
							<Button
								onClick={handlePull}
								disabled={syncing}
								variant="outline"
								className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 gap-2"
							>
								<CloudDownload className="h-4 w-4" />
								Pull from Cloud
							</Button>
						</div>

						{lastResult && (
							<div
								className={`p-4 rounded-lg border ${
									lastResult.status === "success"
										? "bg-emerald-950/50 border-emerald-800 text-emerald-300"
										: "bg-red-950/50 border-red-800 text-red-300"
								}`}
							>
								<div className="flex items-center gap-2">
									{lastResult.status === "success" ? (
										<CheckCircle className="h-5 w-5" />
									) : (
										<XCircle className="h-5 w-5" />
									)}
									<span className="font-medium">{lastResult.message}</span>
								</div>
							</div>
						)}
					</CardContent>
				</Card>

				{/* App Info */}
				<Card className="bg-zinc-900 border-zinc-800 text-white">
					<CardHeader>
						<CardTitle>Application Info</CardTitle>
					</CardHeader>
					<CardContent className="space-y-2 text-sm">
						<div className="flex justify-between">
							<span className="text-zinc-400">Version</span>
							<span className="font-mono">1.0.0</span>
						</div>
						<div className="flex justify-between">
							<span className="text-zinc-400">Database</span>
							<span className="font-mono">SQLite (Local)</span>
						</div>
						<div className="flex justify-between">
							<span className="text-zinc-400">Cloud</span>
							<span className="font-mono text-blue-400">Supabase</span>
						</div>
					</CardContent>
				</Card>

				{/* Storage Info */}
				<Card className="bg-zinc-900 border-zinc-800 text-white">
					<CardHeader>
						<CardTitle>Storage</CardTitle>
					</CardHeader>
					<CardContent className="space-y-2 text-sm">
						<div className="flex justify-between">
							<span className="text-zinc-400">Local Database</span>
							<span className="text-emerald-400">Connected</span>
						</div>
						<div className="flex justify-between">
							<span className="text-zinc-400">Cloud Status</span>
							<span className="text-blue-400">Available</span>
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
