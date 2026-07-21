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

// Web Audio API Synthesizer
const playSound = (type: 'win' | 'tick' | 'start' | 'lose') => {
  if (typeof window === 'undefined') return;
  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.connect(gain);
  gain.connect(ctx.destination);

  const now = ctx.currentTime;

  if (type === 'tick') {
    osc.type = 'square';
    osc.frequency.setValueAtTime(800, now);
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc.start(now);
    osc.stop(now + 0.05);
  } else if (type === 'win') {
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.setValueAtTime(554.37, now + 0.1); // C#
    osc.frequency.setValueAtTime(659.25, now + 0.2); // E
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    osc.start(now);
    osc.stop(now + 0.4);
  } else if (type === 'start') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(600, now + 0.15);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.start(now);
    osc.stop(now + 0.15);
  } else if (type === 'lose') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.3);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc.start(now);
    osc.stop(now + 0.3);
  }
};

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
    ctx.fillStyle = '#f4f4f5'; // zinc-100
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
  const [highScores, setHighScores] = useState<number[]>([]);

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
    ctx.strokeStyle = '#f4f4f5'; // zinc-100
    ctx.lineWidth = 4;
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('draw_ai_highscores');
    if (saved) {
      try {
        setHighScores(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse high scores', e);
      }
    }
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
      setTimeLeft((prev) => {
        const nextTime = prev - 1;
        // 🔊 Sound trigger: Play tick when 6 seconds or less remain
        if (nextTime <= 6 && nextTime > 0) {
          playSound('tick');
        }
        return nextTime;
      });
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
    playSound('start');
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
      playSound('win');
      pointsEarned = timeLeft * 10;
      setMatchScore((prev) => prev + pointsEarned);
      setAiGuess(`🎉 Correct! Match confirmed! (+${pointsEarned} pts)`);
      // Trigger temporary score flash animation
      setAnimateScore(true);
      setTimeout(() => setAnimateScore(false), 300); // matches transition time
    } else {
      playSound('lose');
      setAiGuess(`⏰ Time's up! Moving to next round.`);
    }

    // Step to the next round if under 5
    if (roundNumber < 5) {
      setRoundNumber((prev) => prev + 1);
    } else {
      // End of game match sequence
      setRoundNumber(6);

      setHighScores((prev) => {
        const updated = [...prev, matchScore].sort((a, b) => b - a).slice(0, 3);
        localStorage.setItem('draw_ai_highscores', JSON.stringify(updated));
        return updated;
      });
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
    setIsDrawing(true);

    if (canvasMode === 'pixel') {
      drawPixelBlock(e.clientX, e.clientY, rect, ctx);
    } else {
      ctx.beginPath();
      ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    }
  };

  const startDrawingTouch = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!isPlaying) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    setIsDrawing(true);

    if (canvasMode === 'pixel') {
      drawPixelBlock(touch.clientX, touch.clientY, rect, ctx);
    } else {
      ctx.beginPath();
      ctx.moveTo(touch.clientX - rect.left, touch.clientY - rect.top);
    }
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
    setHasNewDrawings(true);

    if (canvasMode === 'pixel') {
      drawPixelBlock(touch.clientX, touch.clientY, rect, ctx);
    } else {
      ctx.lineTo(touch.clientX - rect.left, touch.clientY - rect.top);
      ctx.stroke();
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    setHasNewDrawings(true);

    if (canvasMode === 'pixel') {
      drawPixelBlock(e.clientX, e.clientY, rect, ctx);
    } else {
      ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
      ctx.stroke();
    }
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
    <main className="min-h-screen bg-radial from-zinc-900 to-black flex flex-col items-center justify-center p-6 text-zinc-100 selection:bg-zinc-800 antialiased">
      <div className="w-full max-w-md space-y-6">
        
        {/* Neon Glass Header Indicators */}
        <div className="flex justify-between items-center bg-zinc-900/60 backdrop-blur-md px-5 py-3 rounded-xl border border-zinc-800/80 shadow-lg text-xs tracking-wider uppercase">
          <div className="font-medium text-zinc-400">
            Score: <span className={`font-bold font-mono text-base inline-block transition-all duration-300 ${animateScore ? 'text-emerald-400 scale-125 font-black drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]' : 'text-zinc-100'}`}>{matchScore}</span>
          </div>
          <div className="font-medium text-zinc-400">
            Round: <span className="text-zinc-100 font-bold font-mono text-sm bg-zinc-800 px-2 py-0.5 rounded-md border border-zinc-700">{roundNumber > 5 ? '5' : roundNumber}/5</span>
          </div>
          {isPlaying && (
            <div className="font-medium text-zinc-400">
              Time: <span className={`font-mono font-bold text-sm transition-all ${timeLeft <= 10 ? 'text-rose-500 scale-110 inline-block animate-pulse drop-shadow-[0_0_6px_rgba(244,63,94,0.6)]' : 'text-zinc-100'}`}>{timeLeft}s</span>
            </div>
          )}
        </div>

        {/* Dynamic Prompt Dashboard Deck */}
        <div className="text-center bg-zinc-950/80 border border-zinc-800/80 backdrop-blur-md py-5 rounded-2xl shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-zinc-700 to-transparent animate-pulse" />
          <p className="text-[10px] tracking-widest uppercase text-zinc-500 font-bold">Current Target Mission</p>
          <h2 className={`text-3xl font-black tracking-tight mt-1 transition-all duration-300 ${isPlaying ? 'text-zinc-100 drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]' : 'text-zinc-600'}`}>
            {isPlaying ? currentPrompt : 'System Ready'}
          </h2>
        </div>

        {/* High-Fi Difficulty Selector */}
        {!isPlaying && (
          <div className="grid grid-cols-3 gap-2 bg-zinc-950/80 p-1 rounded-xl border border-zinc-800 shadow-xl text-xs font-semibold uppercase tracking-wider">
            {(['easy', 'medium', 'hard'] as Difficulty[]).map((tier) => (
              <button
                key={tier}
                onClick={() => setDifficulty(tier)}
                className={`py-2 rounded-lg transition-all duration-200 ease-out active:scale-95 cursor-pointer text-center ${
                  difficulty === tier
                    ? 'bg-zinc-100 text-zinc-950 font-bold shadow-md shadow-white/5'
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/50'
                }`}
              >
                {tier}
              </button>
            ))}
          </div>
        )}

        {/* Canvas Style Switcher */}
        {!isPlaying && (
          <div className="flex justify-center space-x-6 text-xs font-semibold tracking-wide uppercase text-zinc-400">
            <button
              onClick={() => setCanvasMode('classic')}
              className={`pb-1 transition-colors border-b-2 cursor-pointer ${canvasMode === 'classic' ? 'text-zinc-100 border-zinc-100' : 'border-transparent hover:text-zinc-300'}`}
            >
              Classic Ink
            </button>
            <button
              onClick={() => setCanvasMode('pixel')}
              className={`pb-1 transition-colors border-b-2 cursor-pointer ${canvasMode === 'pixel' ? 'text-zinc-100 border-zinc-100' : 'border-transparent hover:text-zinc-300'}`}
            >
              Retro Pixel
            </button>
          </div>
        )}

        {/* Interactive Arcade Screen Canvas Wrapper */}
        <div className={`bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden aspect-square touch-none relative transition-all duration-500 ${
          isPlaying 
            ? 'shadow-[0_0_25px_rgba(24,24,27,0.8)] border-zinc-700' 
            : 'shadow-black'
        }`}>
          {roundNumber === 6 ? (
            <div className="absolute inset-0 bg-zinc-950/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center space-y-4 text-white z-10">
              <span className="text-xs font-mono uppercase tracking-widest text-zinc-500">Match Completed</span>
              <h3 className="text-4xl font-black tracking-tight text-emerald-400 font-mono drop-shadow-[0_0_12px_rgba(52,211,153,0.3)]">{matchScore} pts</h3>
              <p className="text-xs text-zinc-400 max-w-xs leading-relaxed">
                Match summary recorded. Compare your final score against your top historical records below!
              </p>

              {/* High Score Leaderboard Panel */}
              {highScores.length > 0 && (
                <div className="w-full max-w-xs bg-zinc-900/80 p-3 rounded-xl border border-zinc-800 text-left space-y-1.5 my-2">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 font-bold mb-1">Personal Best Records</div>
                  {highScores.map((scoreItem, idx) => (
                    <div key={idx} className="flex justify-between items-center text-xs font-mono px-2 py-1 rounded bg-zinc-950/50 border border-zinc-800/50">
                      <span className="text-zinc-500">#{idx + 1} Record</span>
                      <span className="text-emerald-400 font-bold">{scoreItem} pts</span>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={resetEntireMatch}
                className="px-6 py-2.5 bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-bold uppercase tracking-wider rounded-xl shadow-lg transition-all active:scale-95 cursor-pointer"
              >
                Play New Match
              </button>
            </div>
          ) : (
            !isPlaying && (
              <div className="absolute inset-0 bg-zinc-950/60 backdrop-blur-xs flex flex-col items-center justify-center space-y-3 z-10">
                <button
                  onClick={startGame}
                  className="px-6 py-3 bg-zinc-100 hover:bg-white text-zinc-950 font-bold text-xs uppercase tracking-widest rounded-xl shadow-xl transition-all active:scale-95 cursor-pointer"
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

        {/* Cyberpunk AI Analytics Feedback Box */}
        <div className={`p-4 rounded-xl border transition-all duration-300 bg-zinc-950/50 backdrop-blur-sm ${
          isAiThinking 
            ? 'border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.1)]' 
            : aiGuess.includes('🎉') 
              ? 'border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.1)]'
              : 'border-zinc-800'
        }`}>
          <div className="flex justify-between items-center mb-1">
            <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Neural Link Predictions</div>
            {isAiThinking && (
              <div className="flex items-center space-x-1.5">
                <span className="text-[10px] text-amber-500 font-mono font-bold uppercase animate-pulse">Analyzing</span>
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
              </div>
            )}
          </div>
          <div className={`font-semibold tracking-wide text-sm ${
            aiGuess.includes('🎉') ? 'text-emerald-400' : isAiThinking ? 'text-amber-400' : 'text-zinc-300'
          }`}>{aiGuess}</div>
        </div>

      </div>
    </main>
  );
}