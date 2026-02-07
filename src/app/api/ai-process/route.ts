export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Use your working Gemini model
const GEMINI_MODEL = "gemini-3-flash-preview";

type AIResult = { summary: string; rephrased: string };

function buildPrompt(inputText: string, readingLevel: string) {
  const levelInstructions: Record<string, string> = {
    mild: `Rephrase rules:
- Break long sentences into shorter ones (max 15 words)
- Use simpler punctuation (avoid semicolons)
- Keep most vocabulary but replace uncommon words
- Active voice instead of passive
- Write as a continuous paragraph (NO lists or numbers)`,

    moderate: `Rephrase rules:
- Use simple, everyday words
- Max 12 words per sentence
- One idea per sentence
- Active voice only
- Write as a continuous paragraph (NO lists or numbers)
- Avoid abbreviations`,

    severe: `Rephrase rules:
- Very basic vocabulary (age 8-10)
- Max 8 words per sentence
- No metaphors or idioms
- Bold key terms like **word**
- Write as a continuous paragraph (NO lists or numbers)
- Use "you" and "we" to make it personal`,

    default: `Do not rephrase. Return original text.`,
  };

  const instructions = levelInstructions[readingLevel] || levelInstructions["moderate"];

  return `
    You are an expert dyslexia reading assistant.
    Return ONLY valid JSON: {"summary":"...","rephrased":"..."}
    
    Summary rules:
    - 2-4 short sentences
    - Plain language
    
    ${instructions}
    
    IMPORTANT: Do not include "1.", "2.", or bullet points in the "rephrased" text. 
    Just write standard sentences separated by periods.
    
    Text to process:
    """${inputText}"""
  `;
}

// Helper to clean JSON markdown
function cleanJson(text: string) {
  return text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
}

export async function POST(req: Request) {
  try {
    const { inputText, readingLevel } = await req.json();

    if (!inputText) return NextResponse.json({ error: "No text provided" }, { status: 400 });

    const prompt = buildPrompt(inputText.slice(0, 15000), readingLevel || "moderate");
    let data: AIResult | null = null;

    // 1. Try Gemini
    if (process.env.GEMINI_API_KEY) {
      try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: GEMINI_MODEL, generationConfig: { responseMimeType: "application/json" } });
        const result = await model.generateContent(prompt);
        const raw = result.response.text();
        data = JSON.parse(cleanJson(raw));
      } catch (e) {
        console.error("Gemini failed, trying fallback...", e);
      }
    }

    if (!data) throw new Error("All AI services failed");

    return NextResponse.json(data);

  } catch (err: any) {
    console.error("AI Error:", err);
    return NextResponse.json({ error: "AI processing failed" }, { status: 500 });
  }
}