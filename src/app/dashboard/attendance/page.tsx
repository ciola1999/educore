import { AttendanceForm } from "@/components/attendance/attendance-form";

export default function AttendancePage() {
	return (
		<div className="space-y-6">
			<div>
				<h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
					Attendance
				</h2>
				<p className="text-zinc-400 mt-1">
					Record daily student attendance for your class.
				</p>
			</div>

			<AttendanceForm />
		</div>
	);
}
