import { AddStudentDialog } from "@/components/student/add-student-dialog";
import { StudentList } from "@/components/student/student-list";

export default function StudentsPage() {
	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
						Students
					</h2>
					<p className="text-zinc-400 mt-1">
						Manage student data, parents, and academic records.
					</p>
				</div>
				<AddStudentDialog />
			</div>

			<StudentList />
		</div>
	);
}
