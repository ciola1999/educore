"use client";

import { Button } from "@/components/ui/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { deleteClass, getClasses } from "@/lib/services/academic";
import { Loader2, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { AddClassDialog } from "./add-class-dialog";
import { EditClassDialog } from "./edit-class-dialog";

export function ClassList() {
	const [data, setData] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);

	async function fetchData() {
		setLoading(true);
		try {
			const result = await getClasses();
			setData(result);
		} catch (e) {
			console.error(e);
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => {
		fetchData();
	}, []);

	async function handleDelete(id: string) {
		if (confirm("Delete this class?")) {
			await deleteClass(id);
			fetchData();
		}
	}

	if (loading && data.length === 0)
		return <Loader2 className="h-8 w-8 animate-spin mx-auto text-zinc-500" />;

	return (
		<div className="space-y-4">
			<div className="flex justify-end">
				<AddClassDialog onSuccess={fetchData} />
			</div>

			<div className="rounded-lg border border-zinc-800 bg-zinc-900 overflow-hidden">
				<Table>
					<TableHeader>
						<TableRow className="border-zinc-800 hover:bg-zinc-900">
							<TableHead className="text-zinc-400">Class Name</TableHead>
							<TableHead className="text-zinc-400">Year</TableHead>
							<TableHead className="text-zinc-400">Homeroom Teacher</TableHead>
							<TableHead className="text-zinc-400 text-right">
								Actions
							</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{data.length === 0 ? (
							<TableRow>
								<TableCell
									colSpan={4}
									className="h-24 text-center text-zinc-500"
								>
									No classes found.
								</TableCell>
							</TableRow>
						) : (
							data.map((item) => (
								<TableRow
									key={item.id}
									className="border-zinc-800 hover:bg-zinc-800/50 text-zinc-300"
								>
									<TableCell className="font-medium text-white">
										{item.name}
									</TableCell>
									<TableCell>{item.academicYear}</TableCell>
									<TableCell>{item.homeroomTeacherName || "-"}</TableCell>
									<TableCell className="text-right flex justify-end gap-1">
										<EditClassDialog classData={item} onSuccess={fetchData} />
										<Button
											size="icon"
											variant="ghost"
											className="h-8 w-8 text-zinc-400 hover:text-red-400"
											onClick={() => handleDelete(item.id)}
										>
											<Trash2 className="h-4 w-4" />
										</Button>
									</TableCell>
								</TableRow>
							))
						)}
					</TableBody>
				</Table>
			</div>
		</div>
	);
}
