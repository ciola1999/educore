"use client";

import { Button } from "@/components/ui/button";
import { Download, Printer, User } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useRef } from "react";

interface IDCardProps {
	name: string;
	id: string; // NIS or UUID
	role: string;
	photo?: string;
}

export function IDCardView({ name, id, role, photo }: IDCardProps) {
	const cardRef = useRef<HTMLDivElement>(null);

	const handlePrint = () => {
		const printContent = cardRef.current;
		const windowUrl = "about:blank";
		const uniqueName = Date.now();
		const windowName = `Print_${uniqueName}`;
		const printWindow = window.open(
			windowUrl,
			windowName,
			"left=500,top=500,width=900,height=900",
		);

		if (printWindow && printContent) {
			printWindow.document.write(`
				<html>
					<head>
						<title>Print ID Card - ${name}</title>
						<style>
							body { margin: 0; display: flex; justify-content: center; align-items: center; height: 100vh; background: white; font-family: sans-serif; }
							.card-container { width: 320px; height: 500px; border-radius: 20px; border: 2px solid #333; overflow: hidden; position: relative; background: #f9f9f9; box-shadow: 0 10px 30px rgba(0,0,0,0.1); }
							.header { background: #18181b; color: white; padding: 30px 20px; text-align: center; }
							.header h1 { margin: 0; font-size: 24px; letter-spacing: 2px; }
							.photo-box { width: 140px; height: 140px; border-radius: 50%; border: 4px solid white; margin: -70px auto 20px; overflow: hidden; background: #eee; position: relative; z-index: 10; display: flex; align-items: center; justify-content: center; }
							.info { text-align: center; padding: 20px; }
							.info h2 { margin: 10px 0 5px; font-size: 22px; color: #18181b; }
							.info p { margin: 0; color: #666; font-size: 14px; text-transform: uppercase; font-weight: bold; letter-spacing: 1px; }
							.qr-box { margin-top: 30px; display: flex; flex-direction: column; align-items: center; gap: 10px; }
							.footer { position: absolute; bottom: 0; width: 100%; background: #18181b; color: #555; font-size: 10px; padding: 10px 0; text-align: center; }
						</style>
					</head>
					<body>
						${printContent.innerHTML}
						<script>
							window.onload = function() { window.print(); window.close(); };
						</script>
					</body>
				</html>
			`);
			printWindow.document.close();
		}
	};

	return (
		<div className="flex flex-col items-center gap-6">
			{/* Preview Card */}
			<div
				ref={cardRef}
				className="card-container w-[320px] h-[500px] rounded-[2.5rem] bg-white text-zinc-900 overflow-hidden shadow-2xl relative border border-zinc-200"
			>
				<div className="header h-[120px] bg-zinc-950 flex items-center justify-center pt-4">
					<h1 className="text-white text-2xl font-black tracking-widest italic">
						EDUCORE
					</h1>
				</div>

				<div className="relative z-10 -mt-16 flex flex-col items-center">
					<div className="w-36 h-36 rounded-full border-4 border-white shadow-xl bg-zinc-100 overflow-hidden flex items-center justify-center">
						{photo ? (
							<img
								src={photo}
								alt={name}
								className="w-full h-full object-cover"
							/>
						) : (
							<User className="w-20 h-20 text-zinc-300" />
						)}
					</div>

					<div className="text-center mt-6 px-6">
						<h2 className="text-2xl font-bold text-zinc-950 truncate max-w-[280px]">
							{name}
						</h2>
						<p className="text-blue-600 font-black tracking-widest text-xs uppercase mt-1">
							{role}
						</p>
					</div>

					<div className="qr-box mt-10 p-4 bg-zinc-50 rounded-3xl border border-zinc-100 flex flex-col items-center gap-4">
						<QRCodeSVG value={id} size={120} level="H" />
						<p className="font-mono text-[10px] text-zinc-400 font-bold">
							{id}
						</p>
					</div>
				</div>

				<div className="absolute bottom-0 w-full py-4 text-center bg-zinc-950">
					<p className="text-[10px] text-zinc-600 font-bold tracking-[0.3em]">
						SCHOOL ID CARD SYSTEM
					</p>
				</div>
			</div>

			<div className="flex gap-4">
				<Button
					onClick={handlePrint}
					className="bg-zinc-900 hover:bg-black text-white px-8 h-12 rounded-xl gap-2 font-bold shadow-lg shadow-zinc-500/10 transition-all active:scale-95"
				>
					<Printer className="h-5 w-5" /> Print Card
				</Button>
				<Button
					variant="outline"
					className="border-zinc-200 text-zinc-600 px-8 h-12 rounded-xl gap-2 font-bold transition-all active:scale-95"
				>
					<Download className="h-5 w-5" /> Save PDF
				</Button>
			</div>
		</div>
	);
}
