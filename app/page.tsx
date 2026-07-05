'use client';

import { useRef, useState, useEffect } from 'react';

// A starter list of things that are fun and relatively simple to sketch
const PROMPTS = ['Tree', 'House', 'Car', 'Apple', 'Bicycle', 'Sword', 'Cloud', 'Smile'];

export default function GamePage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  
  // Game States
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPrompt, setCurrentPrompt] = useState('');
  const [timeLeft, setTimeLeft] = useState(30);
  const [score, setScore] = useState(0);
  const [aiGuess, setAiGuess] = useState('Waiting for game to start...');

  // Setup Canvas Dimensions & Brush Styling
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#18181b'; // zinc-900
    ctx.lineWidth = 4;
  }, []);

  // Game Countdown Timer Hook
  useEffect(() => {
    if (!isPlaying || timeLeft <= 0) {
      if (timeLeft === 0 && isPlaying) {
        endGame(false);
      }
      return;
    }

    const timer = setTimeout(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [isPlaying, timeLeft]);

  // Start a Brand New Round
  const startGame = () => {
    clearCanvas();
    const randomPrompt = PROMPTS[Math.floor(Math.random() * PROMPTS.length)];
    setCurrentPrompt(randomPrompt);
    setTimeLeft(30);
    setIsPlaying(true);
    setAiGuess('Thinking...');
  };

  const endGame = (won: boolean) => {
    setIsPlaying(false);
    if (won) {
      const pointsEarned = timeLeft * 10; // More points for speed
      setScore((prev) => prev + pointsEarned);
      setAiGuess(`🎉 Correct! You drew a ${currentPrompt}! (+${pointsEarned} pts)`);
    } else {
      setAiGuess(`⏰ Time's up! Game over.`);
    }
  };

  // Canvas Drawing Logic
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isPlaying) return; // Prevent drawing if game hasn't started
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

  const stopDrawing = () => setIsDrawing(false);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  // Temporary function to simulate a correct guess for testing
  const simulateAiMatch = () => {
    if (isPlaying) endGame(true);
  };

  return (
    <main className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center p-6 text-zinc-900 selection:bg-zinc-200">
      <div className="w-full max-w-md space-y-6">
        
        {/* Top Header: Score & Timer */}
        <div className="flex justify-between items-center bg-white px-4 py-3 rounded-xl border border-zinc-200 shadow-xs">
          <div className="text-sm font-medium text-zinc-500">
            Score: <span className="text-zinc-900 font-bold font-mono">{score}</span>
          </div>
          <div className="text-sm font-medium text-zinc-500">
            Time Left: <span className={`font-bold font-mono ${timeLeft <= 10 ? 'text-rose-600 animate-pulse' : 'text-zinc-900'}`}>{timeLeft}s</span>
          </div>
        </div>

        {/* Prompt Card */}
        <div className="text-center bg-zinc-900 text-zinc-50 py-6 rounded-2xl shadow-md space-y-1">
          <p className="text-xs tracking-wider uppercase text-zinc-400 font-semibold">Your Prompt</p>
          <h2 className="text-3xl font-extrabold tracking-tight">
            {isPlaying ? currentPrompt : 'Ready?'}
          </h2>
        </div>

        {/* Interactive Drawing Canvas */}
        <div className="bg-white border-2 border-zinc-200 rounded-2xl shadow-inner overflow-hidden aspect-square touch-none relative">
          {!isPlaying && (
            <div className="absolute inset-0 bg-zinc-900/5 backdrop-blur-xs flex flex-col items-center justify-center space-y-3">
              <button
                onClick={startGame}
                className="px-6 py-3 bg-zinc-900 hover:bg-zinc-800 text-white font-semibold rounded-xl shadow-md transition-all active:scale-98 cursor-pointer"
              >
                {score > 0 ? 'Play Next Round' : 'Start Game'}
              </button>
            </div>
          )}
          <canvas
            ref={canvasRef}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            className={`w-full h-full ${isPlaying ? 'cursor-crosshair' : 'cursor-default'}`}
          />
        </div>

        {/* Bottom AI Prediction Status Box */}
        <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-xs space-y-3">
          <div className="text-xs font-mono text-zinc-400 uppercase tracking-wider">AI Live Prediction</div>
          <div className="font-medium text-zinc-700">{aiGuess}</div>
          
          {isPlaying && (
            <button
              onClick={simulateAiMatch}
              className="w-full text-center py-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-600 border border-dashed border-zinc-200 hover:border-zinc-400 rounded-md transition-colors"
            >
              [Dev Option] Simulate AI guessing correctly
            </button>
          )}
        </div>

      </div>
    </main>
  );
}