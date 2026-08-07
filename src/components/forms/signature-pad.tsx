"use client";

import { useEffect, useRef, useState } from "react";
import { Eraser, PenLine } from "lucide-react";

type SignaturePadProps = {
  label: string;
  name: string;
  signerName: string;
  signerNameField: string;
  defaultSignerName?: string | null;
};

export function SignaturePad({
  label,
  name,
  signerName,
  signerNameField,
  defaultSignerName
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dataUrl, setDataUrl] = useState("");
  const [drawing, setDrawing] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const scale = window.devicePixelRatio || 1;
    canvas.width = Math.max(Math.floor(rect.width * scale), 1);
    canvas.height = Math.max(Math.floor(rect.height * scale), 1);
    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }
    context.scale(scale, scale);
    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth = 2;
    context.strokeStyle = "#17212b";
  }, []);

  function point(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) {
      return { x: 0, y: 0 };
    }
    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  }

  function begin(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) {
      return;
    }
    const start = point(event);
    canvas.setPointerCapture(event.pointerId);
    context.beginPath();
    context.moveTo(start.x, start.y);
    setDrawing(true);
  }

  function draw(event: React.PointerEvent<HTMLCanvasElement>) {
    const context = canvasRef.current?.getContext("2d");
    if (!drawing || !context) {
      return;
    }
    const next = point(event);
    context.lineTo(next.x, next.y);
    context.stroke();
  }

  function end() {
    const canvas = canvasRef.current;
    if (!canvas || !drawing) {
      return;
    }
    setDrawing(false);
    setDataUrl(canvas.toDataURL("image/png"));
  }

  function clear() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) {
      return;
    }
    context.clearRect(0, 0, canvas.width, canvas.height);
    setDataUrl("");
  }

  return (
    <div className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-asphalt">{label}</p>
          <p className="mt-1 text-xs text-slate-500">{signerName}</p>
        </div>
        <button
          type="button"
          onClick={clear}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <Eraser className="h-4 w-4" aria-hidden="true" />
          Limpar
        </button>
      </div>
      <input type="hidden" name={name} value={dataUrl} />
      <input type="hidden" name={signerNameField} value={defaultSignerName ?? signerName} />
      <canvas
        ref={canvasRef}
        onPointerDown={begin}
        onPointerMove={draw}
        onPointerUp={end}
        onPointerLeave={end}
        className="h-36 w-full touch-none rounded-md border border-dashed border-slate-300 bg-slate-50"
      />
      <p className="inline-flex items-center gap-2 text-xs text-slate-500">
        <PenLine className="h-3.5 w-3.5" aria-hidden="true" />
        Assine acima usando mouse, caneta ou toque.
      </p>
    </div>
  );
}
