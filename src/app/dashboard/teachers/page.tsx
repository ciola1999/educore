import { AddTeacherDialog } from "@/components/teacher/add-teacher-dialog";
import { TeacherList } from "@/components/teacher/teacher-list";

export default function TeachersPage() {
	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h2 className="text-3xl font-bold tracking-tight bg-linear-to-r from-white to-zinc-400 bg-clip-text text-transparent">
						Teachers
					</h2>
					<p className="text-zinc-400 mt-1">
						Manage teacher and staff accounts.
					</p>
				</div>
				<AddTeacherDialog />
			</div>

			<TeacherList />
		</div>
	);
}
