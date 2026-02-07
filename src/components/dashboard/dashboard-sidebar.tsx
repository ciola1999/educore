"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
	ClipboardList,
	GraduationCap,
	LayoutDashboard,
	LibraryBig,
	LogOut,
	Settings,
	Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const menuItems = [
	{
		label: "Overview",
		icon: LayoutDashboard,
		href: "/dashboard",
		color: "text-sky-500",
	},
	{
		label: "Students",
		icon: Users,
		href: "/dashboard/students",
		color: "text-violet-500",
	},
	{
		label: "Attendance",
		icon: ClipboardList,
		href: "/dashboard/attendance",
		color: "text-emerald-500",
	},
	{
		label: "Teachers",
		icon: GraduationCap,
		href: "/dashboard/teachers",
		color: "text-pink-500",
	},
	{
		label: "Courses",
		icon: LibraryBig,
		href: "/dashboard/courses",
		color: "text-orange-500",
	},
	{
		label: "Settings",
		icon: Settings,
		href: "/dashboard/settings",
		color: "text-gray-500",
	},
];

export function DashboardSidebar() {
	const pathname = usePathname();

	return (
		<div className="h-full bg-zinc-900 border-r border-zinc-800 flex flex-col text-white w-64">
			{/* Header Sidebar */}
			<div className="p-6 flex items-center gap-2 font-bold text-xl tracking-tight border-b border-zinc-800/50">
				<div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-teal-400 flex items-center justify-center text-white text-xs">
					EC
				</div>
				Educore
			</div>

			{/* Menu Items */}
			<div className="flex-1 py-6 flex flex-col gap-1 px-3">
				{menuItems.map((item) => (
					<Link
						key={item.href}
						href={item.href}
						className={cn(
							"flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-all hover:bg-zinc-800",
							pathname === item.href
								? "bg-zinc-800 text-white"
								: "text-zinc-400 hover:text-white",
						)}
					>
						<item.icon className={cn("h-5 w-5", item.color)} />
						{item.label}
					</Link>
				))}
			</div>

			{/* Footer Sidebar */}
			<div className="p-4 border-t border-zinc-800/50">
				<Button
					variant="ghost"
					className="w-full justify-start text-zinc-400 hover:text-red-400 hover:bg-red-900/10 gap-2"
					onClick={() => {
						window.location.href = "/";
					}} // Logout sederhana
				>
					<LogOut className="h-4 w-4" />
					Sign Out
				</Button>
			</div>
		</div>
	);
}
