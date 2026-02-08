import { NextResponse } from 'next/server';
import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";
import { pipeline } from '@xenova/transformers';

// 1. Setup Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// 2. Fallback model chain (tried in order: fast → faster → stable → lite)
const MODEL_CHAIN = [
  "gemini-2.5-flash",          // Primary: best price-performance, stable
  "gemini-3-flash-preview",    // Fallback 1: newest balanced model
  "gemini-2.0-flash",          // Fallback 2: older but very stable (until Mar 2026)
  "gemini-2.5-flash-lite",     // Fallback 3: ultra fast, cost-efficient last resort
];

// 3. Define the NLI Model (Singleton)
let nliClassifier: any = null;

async function getNliClassifier() {
  if (!nliClassifier) {
    nliClassifier = await pipeline('zero-shot-classification', 'Xenova/nli-deberta-v3-xsmall');
  }
  return nliClassifier;
}

/**
 * Tries generating content with each model in the chain.
 * Returns the result from the first model that succeeds.
 */
async function generateWithFallback(prompt: string): Promise<{ text: string; modelUsed: string }> {
  const errors: { model: string; error: string }[] = [];

  for (const modelName of MODEL_CHAIN) {
    try {
      console.log(`[AI] Trying model: ${modelName}`);
      const model: GenerativeModel = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      if (!text || text.trim().length === 0) {
        throw new Error(`Empty response from ${modelName}`);
      }

      console.log(`[AI] ✅ Success with model: ${modelName}`);
      return { text, modelUsed: modelName };
    } catch (err: any) {
      const errorMsg = err?.message || String(err);
      console.warn(`[AI] ❌ Model ${modelName} failed: ${errorMsg}`);
      errors.push({ model: modelName, error: errorMsg });
      // Continue to next model in chain
    }
  }

  // All models failed — build a descriptive error
  const summary = errors.map(e => `${e.model}: ${e.error}`).join(' | ');
  throw new Error(`All ${MODEL_CHAIN.length} models failed. Details: ${summary}`);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { inputText, readingLevel, mode, context } = body;

    // --- FEATURE: CHAT BOT MODE ---
    if (mode === "chat") {
      if (!inputText) return NextResponse.json({ error: "No input provided" }, { status: 400 });

      const chatPrompt = `
        You are an expert accessibility assistant for a user with dyslexia. 
        Current Document Context: "${context ? context.slice(0, 5000) : "No context provided."}"
        
        User Question: "${inputText}"
        
        Task: Provide a helpful, kind, and CONCISE answer (max 2 sentences). 
        Do not use complex words. Speak directly to the user.
      `;

      const { text: answer, modelUsed } = await generateWithFallback(chatPrompt);
      return NextResponse.json({ answer, modelUsed });
    }

    // --- STANDARD MODE: SIMPLIFICATION ---
    if (!inputText) return NextResponse.json({ error: "No text provided" }, { status: 400 });

    let complexityInstruction = "";
    if (readingLevel === 'mild') complexityInstruction = "Keep most original vocabulary. Just fix complex grammar.";
    if (readingLevel === 'moderate') complexityInstruction = "Simplify academic jargon to standard English. High school level.";
    if (readingLevel === 'severe') complexityInstruction = "Simplify A LOT. Basic words only. Short sentences. Explain like I'm 5.";

    const prompt = `
      You are an expert accessibility assistant. 
      Task: Simplify the text below.
      Level: ${readingLevel.toUpperCase()} -> ${complexityInstruction}
      
      CRITICAL OUTPUT FORMAT:
      Return a single JSON OBJECT with two keys:
      1. "rephrased": A JSON ARRAY where each object has:
         - "original": The EXACT sentence from the source text.
         - "simplified": Your rewritten version.
      2. "summary": A concise paragraph summarizing the entire text (max 3 sentences).
      
      SOURCE TEXT:
      "${inputText.slice(0, 4000)}" 
    `;

    const { text, modelUsed } = await generateWithFallback(prompt);

    // Clean JSON
    const cleanJson = text.replace(/```json/g, "").replace(/```/g, "").trim();

    let parsedData = { rephrased: [], summary: "" };
    try {
      parsedData = JSON.parse(cleanJson);
    } catch (e) {
      console.error("JSON Parse Error", e);
      return NextResponse.json({
        rephrased: [{ original: inputText, simplified: text, confidence: 50 }],
        summary: "Error parsing summary.",
        modelUsed,
      });
    }

    // --- PART B: THE "JUDGE" (NLI Check) ---
    const classifier = await getNliClassifier();
    const segments = Array.isArray(parsedData.rephrased) ? parsedData.rephrased : [];

    const verifiedSegments = await Promise.all(segments.map(async (seg: any) => {
      const normInput = inputText.toLowerCase().replace(/\s+/g, ' ');
      const normQuote = seg.original.toLowerCase().replace(/\s+/g, ' ');

      // 1. Grounding Check
      if (!normInput.includes(normQuote.slice(0, 20))) {
        return { ...seg, confidence: 0, reason: "Quote not found" };
      }

      // 2. NLI Check
      try {
        const output = await classifier(seg.original, [seg.simplified], {
          hypothesis_template: "This means {}"
        });

        let nliScore = output.scores[0] * 100;
        if (seg.simplified.length > seg.original.length * 2) nliScore -= 20;

        return { ...seg, confidence: Math.round(nliScore) };

      } catch (err) {
        console.error("NLI Error", err);
        return { ...seg, confidence: 50 };
      }
    }));

    return NextResponse.json({
      rephrased: verifiedSegments,
      summary: parsedData.summary || "No summary generated.",
      modelUsed,
    });

  } catch (error: any) {
    console.error("Pipeline Error:", error);
    return NextResponse.json({ error: error?.message || "Processing failed" }, { status: 500 });
  }
}