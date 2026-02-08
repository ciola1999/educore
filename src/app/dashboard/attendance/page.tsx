import { AttendanceForm } from "@/components/attendance/attendance-form";

export default function AttendancePage() {
	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-3xl font-bold bg-linear-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
					Attendance
				</h1>
				<p className="text-zinc-400 mt-1">
					Record daily student attendance for your class.
				</p>
			</div>

			<AttendanceForm />
		</div>
	);
}
