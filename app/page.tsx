'use client';

import { useRef, useState, useEffect } from 'react';

export default function GamePage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high-DPI displays for crisp canvas lines
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    // Styling for the "brush"
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#18181b'; // zinc-900
    ctx.lineWidth = 4;
  }, []);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  return (
    <main className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center p-6 text-zinc-900">
      <div className="w-full max-w-md space-y-4">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">AI Sketch Game</h1>
          <p className="text-zinc-500 text-sm mt-1">Prompt: <span className="font-semibold text-zinc-800 text-base">A Tree</span></p>
        </div>

        {/* The Drawing Board */}
        <div className="bg-white border-2 border-zinc-200 rounded-2xl shadow-xs overflow-hidden aspect-square touch-none">
          <canvas
            ref={canvasRef}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            className="w-full h-full cursor-crosshair"
          />
        </div>

        {/* Controls */}
        <div className="flex justify-between items-center">
          <button 
            onClick={clearCanvas}
            className="px-4 py-2 text-sm font-medium border border-zinc-200 bg-white hover:bg-zinc-50 rounded-xl transition-colors cursor-pointer"
          >
            Clear Canvas
          </button>
          <div className="text-sm font-mono text-zinc-500">
            AI Status: Waiting...
          </div>
        </div>
      </div>
    </main>
  );
}