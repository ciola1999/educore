"use client";

import { IdCard } from "@/components/common/id-card";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import type { Student } from "@/lib/services/student";
import { Printer } from "lucide-react";
import { useRef } from "react";
import { useReactToPrint } from "react-to-print";

interface StudentIdDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	student: Student | null;
}

export function StudentIdDialog({
	open,
	onOpenChange,
	student,
}: StudentIdDialogProps) {
	const printRef = useRef<HTMLDivElement>(null);

	// Hook untuk menghandle print area spesifik
	const handlePrint = useReactToPrint({
		contentRef: printRef,
		documentTitle: `IDCard-${student?.fullName}`,
		onAfterPrint: () => console.log("Printed successfully"),
	});

	if (!student) return null;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Student ID Card</DialogTitle>
					<DialogDescription>
						Preview ID Card for {student.fullName}. Use the print button to save
						as PDF or print.
					</DialogDescription>
				</DialogHeader>

				{/* Preview Area (Centered) */}
				<div className="flex items-center justify-center bg-gray-50 py-8 rounded-lg border border-dashed border-gray-200">
					{/* Ini yang akan dicetak */}
					<div ref={printRef} className="print:m-4">
						<IdCard
							name={student.fullName}
							idNumber={student.nis}
							userRole="STUDENT"
						/>
					</div>
				</div>

				<div className="flex justify-end gap-2">
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Close
					</Button>
					<Button onClick={() => handlePrint()}>
						<Printer className="mr-2 h-4 w-4" />
						Print Card
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
