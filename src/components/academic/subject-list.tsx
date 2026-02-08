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
import { deleteSubject, getSubjects } from "@/lib/services/academic";
import { Loader2, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AddSubjectDialog } from "./add-subject-dialog";
import { EditSubjectDialog } from "./edit-subject-dialog";

export function SubjectList() {
	const [data, setData] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);

	const fetchData = useCallback(async () => {
		setLoading(true);
		try {
			const result = await getSubjects();
			setData(result);
		} catch (e) {
			console.error(e);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchData();
	}, [fetchData]);

	async function handleDelete(id: string) {
		if (confirm("Delete this subject?")) {
			await deleteSubject(id);
			fetchData();
		}
	}

	if (loading && data.length === 0)
		return <Loader2 className="h-8 w-8 animate-spin mx-auto text-zinc-500" />;

	return (
		<div className="space-y-4">
			<div className="flex justify-end">
				<AddSubjectDialog onSuccess={fetchData} />
			</div>

			<div className="rounded-lg border border-zinc-800 bg-zinc-900 overflow-hidden">
				<Table>
					<TableHeader>
						<TableRow className="border-zinc-800 hover:bg-zinc-900">
							<TableHead className="text-zinc-400">Subject Name</TableHead>
							<TableHead className="text-zinc-400">Code</TableHead>
							<TableHead className="text-zinc-400 text-right">
								Actions
							</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{data.length === 0 ? (
							<TableRow>
								<TableCell
									colSpan={3}
									className="h-24 text-center text-zinc-500"
								>
									No subjects found.
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
									<TableCell className="font-mono">{item.code}</TableCell>
									<TableCell className="text-right flex justify-end gap-1">
										<EditSubjectDialog
											subjectData={item}
											onSuccess={fetchData}
										/>
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
