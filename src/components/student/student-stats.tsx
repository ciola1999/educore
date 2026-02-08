"use client";

import { Card } from "@/components/ui/card";
import { motion } from "framer-motion";
import { GraduationCap, UserCheck, UserMinus, Users } from "lucide-react";

interface StudentStatsProps {
	total: number;
	male: number;
	female: number;
}

export function StudentStats({ total, male, female }: StudentStatsProps) {
	const stats = [
		{
			label: "Total Students",
			value: total,
			icon: Users,
			color: "text-blue-400",
			bg: "bg-blue-400/10",
			border: "border-blue-400/20",
		},
		{
			label: "Male",
			value: male,
			icon: UserCheck,
			color: "text-indigo-400",
			bg: "bg-indigo-400/10",
			border: "border-indigo-400/20",
		},
		{
			label: "Female",
			value: female,
			icon: UserMinus,
			color: "text-pink-400",
			bg: "bg-pink-400/10",
			border: "border-pink-400/20",
		},
		{
			label: "Active Grades",
			value: "12",
			icon: GraduationCap,
			color: "text-emerald-400",
			bg: "bg-emerald-400/10",
			border: "border-emerald-400/20",
		},
	];

	return (
		<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
			{stats.map((stat, index) => (
				<motion.div
					key={stat.label}
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.4, delay: index * 0.1 }}
				>
					<Card
						className={`relative overflow-hidden group border-zinc-800 bg-zinc-900/40 backdrop-blur-xl border ${stat.border}`}
					>
						{/* Hover Glow */}
						<div
							className={`absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-300 pointer-events-none ${stat.bg}`}
						/>

						<div className="p-6 flex items-center gap-4">
							<div className={`p-3 rounded-xl ${stat.bg} ${stat.color}`}>
								<stat.icon className="h-6 w-6" />
							</div>
							<div>
								<p className="text-sm font-medium text-zinc-500">
									{stat.label}
								</p>
								<h3 className="text-2xl font-bold text-white tracking-tight">
									{stat.value}
								</h3>
							</div>
						</div>
					</Card>
				</motion.div>
			))}
		</div>
	);
}
