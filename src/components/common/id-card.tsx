import { cn } from "@/lib/utils";
import React from "react";
import QRCode from "react-qr-code";

interface IdCardProps {
	name: string;
	idNumber: string; // NIS atau NIP
	userRole: "STUDENT" | "TEACHER"; // ✅ Diganti dari 'role' jadi 'userRole'
	schoolName?: string;
	className?: string;
}

export const IdCard = React.forwardRef<HTMLDivElement, IdCardProps>(
	(
		{ name, idNumber, userRole, schoolName = "EDUCORE SCHOOL", className },
		ref,
	) => {
		return (
			<div
				ref={ref}
				className={cn(
					"relative flex h-[54mm] w-[85.6mm] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm print:border-0 print:shadow-none",
					className,
				)}
			>
				{/* Decorative Background */}
				<div className="absolute left-0 top-0 h-full w-4 bg-blue-600 print:bg-blue-600" />
				<div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-blue-50 opacity-50" />
				<div className="absolute -bottom-6 -right-6 h-32 w-32 rounded-full bg-blue-50 opacity-50" />

				{/* Content */}
				<div className="z-10 flex w-full flex-col justify-between p-4 pl-8">
					{/* Header */}
					<div className="flex items-center justify-between">
						<div>
							<h2 className="text-xs font-bold uppercase tracking-widest text-blue-600">
								{schoolName}
							</h2>
							<p className="text-[10px] text-gray-400">Identity Card</p>
						</div>
						{/* Badge Role */}
						<div className="rounded bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700 uppercase">
							{userRole}
						</div>
					</div>

					{/* User Info */}
					<div className="mt-2 flex items-end justify-between">
						<div className="flex flex-col gap-1">
							<div>
								<p className="text-[10px] text-gray-500 uppercase">Name</p>
								<h1 className="line-clamp-1 text-lg font-bold text-gray-900 leading-tight w-40">
									{name}
								</h1>
							</div>
							<div>
								<p className="text-[10px] text-gray-500 uppercase">
									{userRole === "STUDENT" ? "NIS" : "NIP"}
								</p>
								<p className="font-mono text-sm font-semibold text-gray-700">
									{idNumber}
								</p>
							</div>
						</div>

						{/* QR Code */}
						<div className="rounded-lg border border-gray-100 bg-white p-1">
							<QRCode
								value={idNumber}
								size={72}
								style={{ height: "auto", maxWidth: "100%", width: "100%" }}
								viewBox={`0 0 256 256`}
							/>
						</div>
					</div>

					{/* Footer */}
					<div className="mt-2 border-t border-gray-100 pt-2 text-[8px] text-gray-400 text-center">
						This card is capable for digital attendance logging.
					</div>
				</div>
			</div>
		);
	},
);

IdCard.displayName = "IdCard";
