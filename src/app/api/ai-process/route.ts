import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { pipeline } from '@xenova/transformers';

// 1. Setup Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// 2. Define the NLI Model (Singleton)
let nliClassifier: any = null;

async function getNliClassifier() {
  if (!nliClassifier) {
    nliClassifier = await pipeline('zero-shot-classification', 'Xenova/nli-deberta-v3-xsmall');
  }
  return nliClassifier;
}

export async function POST(req: Request) {
  try {
    const { inputText, readingLevel } = await req.json();
    if (!inputText) return NextResponse.json({ error: "No text provided" }, { status: 400 });

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    let complexityInstruction = "";
    if (readingLevel === 'mild') complexityInstruction = "Keep most original vocabulary. Just fix complex grammar. Do NOT simplify too much.";
    if (readingLevel === 'moderate') complexityInstruction = "Simplify academic jargon to standard English. High school level.";
    if (readingLevel === 'severe') complexityInstruction = "Simplify A LOT. Basic words only. Short sentences. Explain like I'm 5.";

    // UPDATED PROMPT: Asks for both 'rephrased' array AND 'summary' string
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

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Clean JSON
    const cleanJson = text.replace(/```json/g, "").replace(/```/g, "").trim();
    
    let parsedData = { rephrased: [], summary: "" };
    try {
      parsedData = JSON.parse(cleanJson);
    } catch (e) {
      console.error("JSON Parse Error", e);
      return NextResponse.json({ 
        rephrased: [{ original: inputText, simplified: text, confidence: 50 }],
        summary: "Error parsing summary."
      });
    }

    // --- PART B: THE "JUDGE" (NLI Check) ---
    const classifier = await getNliClassifier();
    
    // If the model didn't return an array for some reason, handle it
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
      summary: parsedData.summary || "No summary generated." 
    });

  } catch (error) {
    console.error("Pipeline Error:", error);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}