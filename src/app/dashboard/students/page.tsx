"use client";

import { AddStudentDialog } from "@/components/student/add-student-dialog";
import { StudentList } from "@/components/student/student-list";
import { StudentStats } from "@/components/student/student-stats";
import { getStudentStats } from "@/lib/services/student";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

export default function StudentsPage() {
	const [stats, setStats] = useState({ total: 0, male: 0, female: 0 });

	const fetchStats = useCallback(async () => {
		try {
			const data = await getStudentStats();
			setStats(data);
		} catch (error) {
			console.error("Failed to fetch stats:", error);
		}
	}, []);

	useEffect(() => {
		fetchStats();
	}, [fetchStats]);

	return (
		<motion.div
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			className="space-y-8 pb-10"
		>
			{/* 🏛️ PREMIUM HEADER */}
			<div className="relative overflow-hidden rounded-3xl bg-zinc-900/50 p-8 border border-zinc-800 shadow-2xl backdrop-blur-sm">
				{/* Background Accents */}
				<div className="absolute top-0 right-0 -mr-16 -mt-16 h-64 w-64 rounded-full bg-blue-600/10 blur-[100px]" />
				<div className="absolute bottom-0 left-0 -ml-16 -mb-16 h-64 w-64 rounded-full bg-indigo-600/10 blur-[100px]" />

				<div className="relative flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
					<div>
						<motion.div
							initial={{ x: -20, opacity: 0 }}
							animate={{ x: 0, opacity: 1 }}
							transition={{ delay: 0.2 }}
							className="flex items-center gap-2 mb-2"
						>
							<div className="h-2 w-8 bg-blue-500 rounded-full" />
							<span className="text-xs font-bold uppercase tracking-widest text-blue-400">
								Main Dashboard
							</span>
						</motion.div>
						<h2 className="text-4xl font-black tracking-tight bg-gradient-to-br from-white via-white to-zinc-500 bg-clip-text text-transparent sm:text-5xl">
							Students Management
						</h2>
						<p className="text-zinc-400 mt-3 text-lg max-w-2xl leading-relaxed">
							Seamlessly manage your academic records, student profiles, and
							parent communications with high-performance tools.
						</p>
					</div>

					<motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
						<AddStudentDialog />
					</motion.div>
				</div>
			</div>

			{/* 📊 STATS OVERVIEW */}
			<section className="space-y-4">
				<div className="flex items-center gap-2 px-1">
					<Sparkles className="h-4 w-4 text-yellow-500" />
					<h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
						Live Insights
					</h3>
				</div>
				<StudentStats
					total={stats.total}
					male={stats.male}
					female={stats.female}
				/>
			</section>

			{/* 📝 MAIN LIST */}
			<motion.div
				initial={{ y: 20, opacity: 0 }}
				animate={{ y: 0, opacity: 1 }}
				transition={{ delay: 0.4 }}
				className="relative"
			>
				<StudentList />
			</motion.div>
		</motion.div>
	);
}
