"use client";

import { Download, Printer, User } from "lucide-react";
import Image from "next/image";
import { QRCodeSVG } from "qrcode.react";
import { useRef, useState } from "react";
import { useReactToPrint } from "react-to-print";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { isTauri } from "@/core/env";
import { cn } from "@/lib/utils";

interface IDCardProps {
  name: string;
  id: string; // NIS or NIP
  personRole: string;
  photo?: string;
  nisn?: string;
  position?: string;
  address?: string;
}

export function IDCardView({
  name,
  id,
  personRole,
  photo,
  nisn,
  position,
  address,
}: IDCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  const isStudent = personRole.toLowerCase() === "student";

  const handlePrint = useReactToPrint({
    contentRef: cardRef,
    documentTitle: `EDUCORE-ID-CARD-${id}`,
    pageStyle: `
      @page {
        size: 8.56cm 5.4cm landscape;
        margin: 0;
      }
      body {
        margin: 0;
        padding: 0;
      }
      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
    `,
    onPrintError: () => {
      toast.error("Gagal membuka dialog print.");
    },
  });

  async function handleDownloadPdf() {
    if (!cardRef.current) {
      return;
    }

    setDownloading(true);
    toast.info("Menyiapkan PDF kartu...");
    try {
      const [{ toPng }, { jsPDF }] = await Promise.all([
        import("html-to-image"),
        import("jspdf"),
      ]);
      const imageData = await toPng(cardRef.current, {
        backgroundColor: "#ffffff",
        cacheBust: true,
        pixelRatio: 3,
      });
      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: [85.6, 54],
        compress: true,
      });

      pdf.addImage(imageData, "PNG", 0, 0, 85.6, 54, undefined, "FAST");
      const fileName = `id-card-${id}.pdf`;
      const pdfArrayBuffer = pdf.output("arraybuffer");

      if (isTauri()) {
        const [{ save }, { writeFile }] = await Promise.all([
          import("@tauri-apps/plugin-dialog"),
          import("@tauri-apps/plugin-fs"),
        ]);
        const filePath = await save({
          defaultPath: fileName,
          filters: [{ name: "PDF", extensions: ["pdf"] }],
        });

        if (!filePath) {
          toast.info("Simpan PDF dibatalkan.");
          return;
        }

        await writeFile(filePath, new Uint8Array(pdfArrayBuffer));
        toast.success("PDF kartu siswa berhasil disimpan.");
        return;
      }

      const blob = new Blob([pdfArrayBuffer], {
        type: "application/pdf",
      });
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(objectUrl);

      toast.success("PDF kartu siswa berhasil diunduh.");
    } catch (error) {
      console.error("[ID_CARD_PDF_ERROR]", error);
      toast.error(
        error instanceof Error ? error.message : "Gagal membuat PDF kartu.",
      );
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-8">
      {/* 
        PREVIEW CARD 
        Measured at 8.56cm x 5.4cm for high-precision landscape standard.
      */}
      <div className="scale-125 md:scale-150 my-12">
        <div
          ref={cardRef}
          className={cn(
            "relative overflow-hidden shadow-2xl transition-all duration-500 rounded-xl border border-zinc-200",
            "w-[8.56cm] h-[5.4cm] bg-white text-zinc-900 flex flex-col",
          )}
          style={{
            fontFamily: "Inter, sans-serif",
            backgroundImage:
              "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)",
          }}
        >
          {/* Background Patterns */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/5 rounded-full -mr-16 -mt-16" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-blue-600/5 rounded-full -ml-12 -mb-12" />

          {/* Header */}
          <div className="relative h-[1.2cm] bg-blue-700 flex items-center justify-center px-4 overflow-hidden border-b-2 border-amber-400">
            <div className="absolute top-0 right-0 w-48 h-full bg-blue-600 skew-x-[-20deg] translate-x-12 opacity-50" />
            <h1 className="relative text-white font-bold text-[13px] tracking-tight whitespace-nowrap text-center">
              YAYASAN PENDIDIKAN MEKARSARI
            </h1>
          </div>

          {/* Body Content */}
          <div className="flex-1 flex px-4 items-center gap-4 relative z-10 py-1">
            {/* Left: Photo (Fixed Size) */}
            <div className="flex-shrink-0 flex flex-col items-center">
              <div className="w-[2.2cm] h-[2.8cm] rounded-md border-2 border-white shadow-md bg-zinc-100 overflow-hidden flex items-center justify-center ring-1 ring-zinc-300">
                {photo ? (
                  <Image
                    src={photo}
                    alt={name}
                    width={150}
                    height={200}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <User className="w-12 h-12 text-zinc-300" />
                )}
              </div>
            </div>

            {/* Middle: Info (Flexible width with wrapping) */}
            <div className="flex-1 flex flex-col justify-center gap-1.5 min-w-0">
              <div className="mb-0.5">
                <h2 className="text-[11px] font-extrabold text-blue-900 leading-[1.2] uppercase break-words hyphens-auto">
                  {name}
                </h2>
              </div>

              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                <div>
                  <p className="text-[6px] text-zinc-400 font-bold uppercase tracking-wider mb-0.5">
                    {isStudent ? "NIS" : "NIP"}
                  </p>
                  <p className="text-[9px] font-bold text-zinc-800 font-mono leading-none">
                    {id}
                  </p>
                </div>
                <div>
                  <p className="text-[6px] text-zinc-400 font-bold uppercase tracking-wider mb-0.5">
                    {isStudent ? "NISN" : "Jabatan"}
                  </p>
                  <p className="text-[9px] font-bold text-zinc-800 leading-none break-words">
                    {isStudent ? nisn || "-" : position || personRole}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-[6px] text-zinc-400 font-bold uppercase tracking-wider mb-0.5">
                    ALAMAT
                  </p>
                  <p className="text-[8px] font-medium text-zinc-600 leading-tight break-words">
                    {address || "KOTA MEKARSARI"}
                  </p>
                </div>
              </div>
            </div>

            {/* Right: QR Code (Fixed Size) */}
            <div className="flex-shrink-0 flex flex-col items-center justify-center p-1.5 bg-white rounded-lg border border-zinc-100 shadow-sm">
              <QRCodeSVG value={id} size={50} level="M" />
            </div>
          </div>

          {/* Footer */}
          <div className="h-[0.3cm] w-full bg-linear-to-r from-blue-700 via-blue-600 to-amber-500 mt-auto" />
        </div>
      </div>

      {/* Control Buttons (Desktop Only) */}
      <div className="relative z-20 flex gap-4 mt-8 no-print">
        <Button
          type="button"
          onClick={handlePrint}
          className="bg-blue-600 hover:bg-blue-700 text-white px-8 h-12 rounded-xl gap-2 font-bold shadow-lg shadow-blue-500/20 transition-all active:scale-95"
        >
          <Printer className="h-5 w-5" /> Print Card
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={handleDownloadPdf}
          disabled={downloading}
          className="border-zinc-200 text-zinc-600 px-8 h-12 rounded-xl gap-2 font-bold transition-all active:scale-95"
        >
          <Download className="h-5 w-5" />
          {downloading ? "Membuat PDF..." : "Export PDF"}
        </Button>
      </div>
    </div>
  );
}
