import { NextRequest } from "next/server";
import { TextToSpeechClient } from "@google-cloud/text-to-speech";

// Initialize client (keeps your existing auth setup)
const client = new TextToSpeechClient({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
});

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const text = searchParams.get("text");
  
  // 1. Get new parameters (with defaults)
  const voiceName = searchParams.get("voice") || "en-US-Journey-F"; // Default Female
  const speed = parseFloat(searchParams.get("speed") || "1.0");     // Default 1.0x

  if (!text) return new Response(JSON.stringify({ error: "Text is required" }), { status: 400 });

  try {
    const request = {
      input: { text: text },
      voice: { 
        languageCode: "en-US", 
        name: voiceName 
      },
      audioConfig: { 
        audioEncoding: "MP3" as const,
        speakingRate: speed, // 2. Apply the speed setting
      },
    };

    const [response] = await client.synthesizeSpeech(request);
    const audioContent = response.audioContent;

    if (!audioContent) throw new Error("No audio content");

    // Convert to Base64
    const base64String = Buffer.from(audioContent as Uint8Array).toString("base64");

    // Return as a single chunk (easier for Seek bars)
    return new Response(JSON.stringify({ 
      base64Chunks: [{ base64: base64String }] 
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("TTS API Error:", err);
    return new Response(JSON.stringify({ error: "TTS failed" }), { status: 500 });
  }
}