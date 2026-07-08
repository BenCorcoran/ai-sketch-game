'use client';

import { useRef, useState, useEffect } from 'react';

const PROMPT_BANKS = {
  easy: ['Tree', 'House', 'Apple', 'Cloud', 'Smile', 'Sun', 'Cat', 'Hat'],
  medium: ['Bicycle', 'Sword', 'Car', 'Airplane', 'Guitar', 'Laptop', 'Spider', 'Bridge'],
  hard: ['Eiffel Tower', 'Microscope', 'DNA Strand', 'Submarine', 'Rollercoaster', 'Helicopter']
};

type Difficulty = 'easy' | 'medium' | 'hard';

export default function GamePage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasNewDrawings, setHasNewDrawings] = useState(false);
  
  // Game States
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPrompt, setCurrentPrompt] = useState('');
  const [timeLeft, setTimeLeft] = useState(30);
  const [score, setScore] = useState(0);
  const [aiGuess, setAiGuess] = useState('Press Start to begin!');
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');

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

  // Countdown Timer Hook
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

  // Automated AI Guessing Interval Loop
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      // Only ping the API if the user has added new lines since the last check
      if (hasNewDrawings && !isAiThinking) {
        checkDrawingWithAI();
      }
    }, 4000); // Evaluates the canvas every 4 seconds

    return () => clearInterval(interval);
  }, [isPlaying, hasNewDrawings, isAiThinking, currentPrompt]);

  // The Core API Call Function
  const checkDrawingWithAI = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setIsAiThinking(true);
    setAiGuess('AI is analyzing your sketch...');

    try {
      // Extract canvas pixels as a base64 PNG data URL
      const dataUrl = canvas.toDataURL('image/png');

      const response = await fetch('/api/guess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataUrl, prompt: currentPrompt }),
      });

      const data = await response.json();

      if (response.ok) {
        if (data.match) {
          endGame(true);
        } else {
          setAiGuess(`AI Thinks it looks like: "${data.prediction}" (Keep drawing!)`);
          setHasNewDrawings(false); // Reset tracking until they sketch more
        }
      } else {
        console.error('API Error:', data.error);
      }
    } catch (err) {
      console.error('Network failure trying to contact AI route:', err);
    } finally {
      setIsAiThinking(false);
    }
  };

  // Start a Brand New Round
  const startGame = () => {
    clearCanvas();
    
    // 1. Grab the specific word list for the chosen difficulty
    const currentBank = PROMPT_BANKS[difficulty];
    
    // 2. Filter out the current prompt to ensure no back-to-back duplicates
    const availablePrompts = currentBank.filter(p => p !== currentPrompt);
    const randomPrompt = availablePrompts[Math.floor(Math.random() * availablePrompts.length)];
    
    // 3. Set the dynamic clock based on difficulty tier
    let initialTime = 30;
    if (difficulty === 'medium') initialTime = 60;
    if (difficulty === 'hard') initialTime = 120;

    setCurrentPrompt(randomPrompt);
    setTimeLeft(initialTime);
    setHasNewDrawings(false);
    setIsPlaying(true);
    setAiGuess('Start sketching! AI will guess automatically...');
  };

  const endGame = (won: boolean) => {
    setIsPlaying(false);
    if (won) {
      const pointsEarned = timeLeft * 10;
      setScore((prev) => prev + pointsEarned);
      setAiGuess(`🎉 Correct! Match confirmed! (+${pointsEarned} pts)`);
    } else {
      setAiGuess(`⏰ Time's up! The AI couldn't lock it down.`);
    }
  };

  // Canvas Drawing Coordinate Capturing
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isPlaying) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    setIsDrawing(true);
  };

  const startDrawingTouch = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!isPlaying) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Prevent mobile scrolling while drawing
    e.preventDefault(); 

    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0]; // Capture the first finger touching the glass
    
    ctx.beginPath();
    ctx.moveTo(touch.clientX - rect.left, touch.clientY - rect.top);
    setIsDrawing(true);
  };

  const drawTouch = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    e.preventDefault();

    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];

    ctx.lineTo(touch.clientX - rect.left, touch.clientY - rect.top);
    ctx.stroke();
    setHasNewDrawings(true);
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
    setHasNewDrawings(true); // Signal that the canvas state has changed
  };

  const stopDrawing = () => setIsDrawing(false);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasNewDrawings(false);
  };

  return (
    <main className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center p-6 text-zinc-900 selection:bg-zinc-200">
      <div className="w-full max-w-md space-y-6">
        
        {/* Header Indicators */}
        <div className="flex justify-between items-center bg-white px-4 py-3 rounded-xl border border-zinc-200 shadow-xs">
          <div className="text-sm font-medium text-zinc-500">
            Score: <span className="text-zinc-900 font-bold font-mono">{score}</span>
          </div>
          <div className="text-sm font-medium text-zinc-500">
            Time Left: <span className={`font-bold font-mono ${timeLeft <= 10 ? 'text-rose-600 animate-pulse' : 'text-zinc-900'}`}>{timeLeft}s</span>
          </div>
        </div>

        {/* Word Directive Card */}
        <div className="text-center bg-zinc-900 text-zinc-50 py-6 rounded-2xl shadow-md space-y-1">
          <p className="text-xs tracking-wider uppercase text-zinc-400 font-semibold">Your Prompt</p>
          <h2 className="text-3xl font-extrabold tracking-tight">
            {isPlaying ? currentPrompt : 'Ready?'}
          </h2>
        </div>

        {/* Visual Matrix Sandbox (Canvas) */}
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
            onTouchStart={startDrawingTouch}
            onTouchMove={drawTouch}
            onTouchEnd={stopDrawing}
            className={`w-full h-full ${isPlaying ? 'cursor-crosshair' : 'cursor-default'}`}
          />
        </div>

        {/* AI Output Box */}
        <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-xs space-y-2">
          <div className="flex justify-between items-center">
            <div className="text-xs font-mono text-zinc-400 uppercase tracking-wider">AI Live Prediction</div>
            {isAiThinking && (
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
            )}
          </div>
          <div className="font-medium text-zinc-700 leading-normal">{aiGuess}</div>
        </div>

      </div>
    </main>
  );
}