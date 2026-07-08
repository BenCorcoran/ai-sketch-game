import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export async function POST(request: Request) {
  try {
    const { image, prompt } = await request.json();

    if (!image || !prompt) {
      return NextResponse.json({ error: 'Missing image data or target prompt.' }, { status: 400 });
    }

    const base64Data = image.split(',')[1] || image;

    let response;
    let retries = 3;
    let delay = 1000; // Start with a 1-second delay adjustment

    // Retry loop for handling transient cloud failures (like 503)
    while (retries > 0) {
      try {
        response = await ai.models.generateContent({
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
        
        // If successful, break out of the retry loop completely
        break; 
      } catch (aiError: any) {
        retries -= 1;
        // If we run out of retries, throw the error out to the main catch block
        if (retries === 0) throw aiError; 
        
        console.warn(`Gemini 503 encounter. Retrying in ${delay}ms... (${retries} attempts left)`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2; // Double the wait time for the next attempt (Exponential Backoff)
      }
    }

    const aiTextResponse = response?.text || '';
    const isMatch = aiTextResponse.includes('MATCH: YES');
    
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
    console.error('Backend AI Error after retries:', error);
    return NextResponse.json({ error: 'AI engine is temporarily overloaded. Keep sketching!' }, { status: 500 });
  }
}