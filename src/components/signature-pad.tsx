"use client";

import { useEffect, useRef } from "react";
import { Eraser } from "lucide-react";
import { Button } from "@/components/ui/button";

type SignaturePadProps = {
  value: string;
  onChange: (value: string) => void;
};

export function SignaturePad({ value, onChange }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    const context = canvas.getContext("2d");
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.lineWidth = 2.5;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#173a43";
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);

    if (value) {
      const image = new Image();
      image.onload = () => context.drawImage(image, 0, 0, width, height);
      image.src = value;
    }
  }, [value]);

  function position(event: React.PointerEvent<HTMLCanvasElement>) {
    const rectangle = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rectangle.left, y: event.clientY - rectangle.top };
  }

  function start(event: React.PointerEvent<HTMLCanvasElement>) {
    const context = event.currentTarget.getContext("2d");
    if (!context) return;
    const point = position(event);
    event.currentTarget.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    context.beginPath();
    context.moveTo(point.x, point.y);
  }

  function move(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const context = event.currentTarget.getContext("2d");
    if (!context) return;
    const point = position(event);
    context.lineTo(point.x, point.y);
    context.stroke();
  }

  function finish(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    onChange(event.currentTarget.toDataURL("image/png"));
  }

  function clear() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.restore();
    onChange("");
  }

  return (
    <div>
      <div className="overflow-hidden rounded-xl border-2 border-dashed border-slate-300 bg-white focus-within:border-cyan-600">
        <canvas
          ref={canvasRef}
          className="h-40 w-full cursor-crosshair touch-none"
          aria-label="Zona para dibujar la firma"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={finish}
          onPointerCancel={finish}
        />
      </div>
      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="text-sm text-slate-500">Firma con el dedo, el lápiz o el ratón.</p>
        <Button type="button" variant="ghost" size="sm" onClick={clear} disabled={!value}>
          <Eraser className="size-4" /> Borrar
        </Button>
      </div>
    </div>
  );
}
