'use client';

import { useRef, useState, useEffect } from 'react';

const PROMPT_BANKS = {
  easy: ['Tree', 'House', 'Apple', 'Cloud', 'Smile', 'Sun', 'Cat', 'Hat'],
  medium: ['Bicycle', 'Sword', 'Car', 'Airplane', 'Guitar', 'Laptop', 'Spider', 'Bridge'],
  hard: ['Eiffel Tower', 'Microscope', 'DNA Strand', 'Submarine', 'Rollercoaster', 'Helicopter']
};

type Difficulty = 'easy' | 'medium' | 'hard';
type CanvasMode = 'classic' | 'pixel';
const PIXEL_GRID_SIZE = 32;

export default function GamePage() {

  const drawPixelBlock = (clientX: number, clientY: number, rect: DOMRect, ctx: CanvasRenderingContext2D) => {
    // 1. Find relative mouse position inside the canvas bounding box
    const relativeX = clientX - rect.left;
    const relativeY = clientY - rect.top;

    // 2. Calculate the size of each individual virtual pixel block
    const blockWidth = rect.width / PIXEL_GRID_SIZE;
    const blockHeight = rect.height / PIXEL_GRID_SIZE;

    // 3. Snap coordinates to the nearest grid cell row and column
    const gridX = Math.floor(relativeX / blockWidth);
    const gridY = Math.floor(relativeY / blockHeight);

    // 4. Paint that single grid block black
    ctx.fillStyle = '#18181b'; // zinc-900
    ctx.fillRect(
      gridX * blockWidth, 
      gridY * blockHeight, 
      blockWidth + 0.5, // +0.5 prevents tiny gaps between blocks when drawing fast
      blockHeight + 0.5
    );
  };

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
  const [roundNumber, setRoundNumber] = useState(1);
  const [matchScore, setMatchScore] = useState(0);
  const [usedPrompts, setUsedPrompts] = useState<string[]>([]);
  const [animateScore, setAnimateScore] = useState(false);
  const [canvasMode, setCanvasMode] = useState<CanvasMode>('classic');

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

  const startGame = () => {
    clearCanvas();
    
    const currentBank = PROMPT_BANKS[difficulty];
    
    // Filter out ANY words already used in this match sequence
    let availablePrompts = currentBank.filter(word => !usedPrompts.includes(word));
    
    // Safety fallback: if they somehow run through all words, reset the pool
    if (availablePrompts.length === 0) {
      availablePrompts = currentBank;
      setUsedPrompts([]);
    }
    
    const randomPrompt = availablePrompts[Math.floor(Math.random() * availablePrompts.length)];
    
    // Record this word as used so it won't appear again this match
    setUsedPrompts((prev) => [...prev, randomPrompt]);

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
    let pointsEarned = 0;

    if (won) {
      pointsEarned = timeLeft * 10;
      setMatchScore((prev) => prev + pointsEarned);
      setAiGuess(`🎉 Correct! Match confirmed! (+${pointsEarned} pts)`);
      // Trigger temporary score flash animation
      setAnimateScore(true);
      setTimeout(() => setAnimateScore(false), 300); // matches transition time
    } else {
      setAiGuess(`⏰ Time's up! Moving to next round.`);
    }

    // Step to the next round if under 5
    if (roundNumber < 5) {
      setRoundNumber((prev) => prev + 1);
    } else {
      // End of game match sequence
      setRoundNumber(6); // 6 will represent our "Match Over summary screen"
    }
  };

  // Helper reset to start a brand new 5-game match from scratch
  const resetEntireMatch = () => {
    setMatchScore(0);
    setRoundNumber(1);
    setUsedPrompts([]);
    clearCanvas();
    setAiGuess('New match started! Press Start to play.');
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
            Total Score: <span className={`text-zinc-900 font-bold font-mono inline-block transition-transform duration-300 ${animateScore ? 'scale-135 text-emerald-600 font-extrabold' : 'scale-100'}`}>{matchScore}</span>
          </div>
          <div className="text-sm font-medium text-zinc-500">
            Round: <span className="text-zinc-900 font-bold font-mono">{roundNumber > 5 ? '5' : roundNumber}/5</span>
          </div>
          {isPlaying && (
            <div className="text-sm font-medium text-zinc-500">
              Time: <span className={`font-mono font-bold transition-all ${timeLeft <= 10 ? 'text-rose-600 scale-110 inline-block animate-pulse' : 'text-zinc-900'}`}>{timeLeft}s</span>
            </div>
          )}
        </div>

        {/* Difficulty Selector */}
        {!isPlaying && (
          <div className="grid grid-cols-3 gap-2 bg-white p-1 rounded-xl border border-zinc-200 shadow-xs text-sm font-medium">
            {(['easy', 'medium', 'hard'] as Difficulty[]).map((tier) => (
              <button
                key={tier}
                onClick={() => setDifficulty(tier)}
                className={`py-1.5 capitalize rounded-lg transition-all duration-200 ease-out active:scale-95 cursor-pointer text-center ${
                  difficulty === tier
                    ? 'bg-zinc-950 text-white shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50'
                }`}
              >
                {tier}
              </button>
            ))}
          </div>
        )}

        {/* Word Directive Card */}
        <div className="text-center bg-zinc-900 text-zinc-50 py-6 rounded-2xl shadow-md space-y-1">
          <p className="text-xs tracking-wider uppercase text-zinc-400 font-semibold">Your Prompt</p>
          <h2 className="text-3xl font-extrabold tracking-tight">
            {isPlaying ? currentPrompt : 'Ready?'}
          </h2>
        </div>

        {/* Visual Matrix Sandbox (Canvas or Summary Screen) */}
        <div className="bg-white border-2 border-zinc-200 rounded-2xl shadow-inner overflow-hidden aspect-square touch-none relative">
          {roundNumber === 6 ? (
            <div className="absolute inset-0 bg-zinc-950 flex flex-col items-center justify-center p-6 text-center space-y-4 text-white">
              <span className="text-xs font-mono uppercase tracking-widest text-zinc-400">Match Completed</span>
              <h3 className="text-4xl font-black tracking-tight text-amber-400 font-mono">{matchScore} pts</h3>
              <p className="text-sm text-zinc-400 max-w-xs leading-normal">
                Excellent running! This is your score to beat. Try shifting difficulties to challenge your baseline.
              </p>
              <button
                onClick={resetEntireMatch}
                className="px-5 py-2.5 bg-white hover:bg-zinc-100 text-zinc-950 text-sm font-bold rounded-xl shadow-xs transition-all cursor-pointer"
              >
                Play New Match
              </button>
            </div>
          ) : (
            !isPlaying && (
              <div className="absolute inset-0 bg-zinc-900/5 backdrop-blur-xs flex flex-col items-center justify-center space-y-3">
                <button
                  onClick={startGame}
                  className="px-6 py-3 bg-zinc-900 hover:bg-zinc-800 text-white font-semibold rounded-xl shadow-md transition-all active:scale-98 cursor-pointer"
                >
                  {usedPrompts.length > 0 ? `Start Round ${roundNumber}` : 'Start Match'}
                </button>
              </div>
            )
          )}
          
          {roundNumber <= 5 && (
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
          )}
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