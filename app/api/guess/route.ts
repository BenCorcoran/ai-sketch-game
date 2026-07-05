import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

// Initialize the Gemini client using the secure environment variable
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export async function POST(request: Request) {
  try {
    const { image, prompt } = await request.json();

    if (!image || !prompt) {
      return NextResponse.json({ error: 'Missing image data or target prompt.' }, { status: 400 });
    }

    // Next.js client-side images usually pass strings like: "data:image/png;base64,iVBORw..."
    // We must extract just the pure raw base64 data string for the AI API
    const base64Data = image.split(',')[1] || image;

    // Call Gemini 2.5 Flash with strict formatting instructions
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          inlineData: {
            mimeType: 'image/png',
            data: base64Data,
          },
        },
        `You are evaluating a simple, minimalist line sketch drawn by a user in an online game.
         The target object they were prompted to draw is: "${prompt}".
         
         Analyze the sketch. Is it a reasonable attempt at drawing a "${prompt}"? 
         
         Respond strictly in this exact format:
         MATCH: [YES or NO]
         GUESS: [A short 1-3 word guess of what the drawing actually looks like if it is not a match]`,
      ],
    });

    const aiTextResponse = response.text || '';

    // Simple parsing logic to see what the AI decided
    const isMatch = aiTextResponse.includes('MATCH: YES');
    
    // Extract what the AI thinks it is for conversational feedback
    let guessedWhat = '';
    const guessLine = aiTextResponse.split('\n').find(line => line.startsWith('GUESS:'));
    if (guessLine) {
      guessedWhat = guessLine.replace('GUESS:', '').trim();
    }

    return NextResponse.json({
      match: isMatch,
      prediction: guessedWhat || 'Unknown drawing'
    });

  } catch (error: any) {
    console.error('Backend AI Error:', error);
    return NextResponse.json({ error: 'Failed to process AI evaluation.' }, { status: 500 });
  }
}