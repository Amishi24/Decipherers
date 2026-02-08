"use client";
import { useState, useEffect, useRef } from "react";
import { Play, Pause, SkipBack, SkipForward, Loader2, Layers, ShieldCheck, AlertTriangle, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"; 
import MagicText from "@/components/magic-text";
import { Download } from "lucide-react";
import { generateSmartPDF } from "@/lib/pdf-gen";
import { X, RotateCcw, MessageSquare, Volume2, StopCircle } from "lucide-react";

const VOICES = [
  { id: "en-US-Journey-F", name: "Journey (Female)" },
  { id: "en-US-Journey-D", name: "Journey (Male)" },
  { id: "en-US-Studio-O", name: "Studio (Female)" },
  { id: "en-US-Studio-M", name: "Studio (Male)" },
];

const OVERLAYS = [
  { name: "None", value: "none", color: "transparent" },
  { name: "Blue", value: "blue", color: "rgba(0, 153, 255, 0.2)" },
  { name: "Yellow", value: "yellow", color: "rgba(255, 255, 0, 0.2)" },
  { name: "Green", value: "green", color: "rgba(0, 255, 0, 0.2)" },
  { name: "Rose", value: "rose", color: "rgba(255, 0, 128, 0.2)" },
  { name: "Peach", value: "peach", color: "rgba(255, 165, 0, 0.2)" },
  { name: "Grey", value: "grey", color: "rgba(128, 128, 128, 0.3)" },
];

type Segment = {
  original: string;
  simplified: string;
  confidence: number;
};

export default function Refined() {
  // --- STATE ---
  const [sourceText, setSourceText] = useState("");
  const [segments, setSegments] = useState<Segment[]>([]); 
  const [summary, setSummary] = useState("");
  const [level, setLevel] = useState("moderate");
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  
  // Settings
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(0);
  const [sentenceFocusMode, setSentenceFocusMode] = useState(false);
  const [confidenceMode, setConfidenceMode] = useState(false); 

  // Audio/Visuals
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [voice, setVoice] = useState("en-US-Journey-F"); 
  const [speed, setSpeed] = useState(1.0);
  const [overlay, setOverlay] = useState(OVERLAYS[0]);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCache = useRef<Record<number, string>>({});

  // --- BOT STATE ---
  const [isListening, setIsListening] = useState(false);
  const [botResponse, setBotResponse] = useState("");
  const [lastQuestion, setLastQuestion] = useState("");
  const [isBotThinking, setIsBotThinking] = useState(false);
  const [isBotSpeaking, setIsBotSpeaking] = useState(false);
  const [isBotPaused, setIsBotPaused] = useState(false);
  // Tracks the "version" of the bot's request to prevent overlapping audio
  const botGenId = useRef(0);
  
  // Bot Audio Reference
  const botUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // --- 1. INITIALIZATION ---
  useEffect(() => {
    const saved = sessionStorage.getItem("pdfText");
    if (saved) setSourceText(saved);
  }, []);

  // --- 2. AI FETCHING ---
  useEffect(() => {
    if (!sourceText) return;
    
    const fetchAI = async () => {
        setIsLoadingAI(true);
        try {
            const res = await fetch("/api/ai-process", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ inputText: sourceText, readingLevel: level })
            });
            const data = await res.json();
            
            if (Array.isArray(data.rephrased)) {
                setSegments(data.rephrased);
            } else {
                setSegments([{ original: sourceText, simplified: data.rephrased || "", confidence: 100 }]);
            }
            if (data.summary) setSummary(data.summary);
        } catch (e) { console.error("AI Error", e); } 
        finally { setIsLoadingAI(false); }
    };
    fetchAI();
  }, [sourceText, level]);

  // --- 3. TTS HANDLING ---
  useEffect(() => {
    if (segments.length === 0) return;

    audioCache.current = {};
    setCurrentSentenceIndex(0);
    setIsPlaying(false);
    if (audioRef.current) audioRef.current.pause();

    const preloadFirst = async () => {
        const url = await fetchAudioBlob(segments[0].simplified);
        if (url) audioCache.current[0] = url;
    };
    preloadFirst();
  }, [segments]); 

  // --- FEATURE: HOT RELOAD BOT AUDIO ---
  // If voice/speed changes, update the bot immediately (just like the main text)
  // --- HOT RELOAD BOT AUDIO ---
  useEffect(() => {
    if (!botResponse) return;

    const currentAudio = (window as any).botAudio;
    const wasPlaying = currentAudio && !currentAudio.paused;

    // Trigger reload if:
    // 1. Audio is currently playing (wasPlaying)
    // 2. OR... Audio is currently LOADING (isBotThinking)
    if (wasPlaying || isBotThinking) {
        speakBotResponse(botResponse); 
    } 
    else if (currentAudio) {
        currentAudio.pause();
        (window as any).botAudio = null;
    }
  }, [voice, speed]);

  useEffect(() => {
    if (segments.length === 0) return;

    audioCache.current = {}; 

    const hotReloadAudio = async () => {
         const wasPlaying = isPlaying;
         if (audioRef.current) audioRef.current.pause();
         
         setIsBuffering(true);
         const url = await fetchAudioBlob(segments[currentSentenceIndex].simplified);
         
         if (url) {
             audioCache.current[currentSentenceIndex] = url;
             if (wasPlaying && audioRef.current) {
                 audioRef.current.src = url;
                 audioRef.current.play();
             }
         }
         setIsBuffering(false);

         if (segments[currentSentenceIndex + 1]) {
             fetchAudioBlob(segments[currentSentenceIndex + 1].simplified).then(u => {
                 if (u) audioCache.current[currentSentenceIndex + 1] = u;
             });
         }
    };
    hotReloadAudio();
  }, [voice, speed]); 

  const handleDownload = () => {
    // 1. Get Filename (saved during upload)
    const savedName = sessionStorage.getItem("pdfName") || "Uploaded Document";

    // 2. READ THE BROWSER STYLES (The "Communication" Link)
    // Since AppSidebar applies styles to <body>, we read them back here.
    const bodyStyles = window.getComputedStyle(document.body);

    // 3. Parse Font Size
    // Returns "18px", so we parseFloat to get 18
    const currentFontSize = parseFloat(bodyStyles.fontSize); 

    // 4. Parse Line Height
    // Can return "normal", "28px", or a number. We need a multiplier.
    let currentLineHeight = parseFloat(bodyStyles.lineHeight);
    // If it's returning px (e.g., "30px" for 15px font), convert to multiplier
    if (currentLineHeight > 10) { 
        currentLineHeight = currentLineHeight / currentFontSize;
    }
    // Fallback for "normal"
    if (isNaN(currentLineHeight)) currentLineHeight = 1.5;

    // 5. Parse Letter Spacing
    // Returns "normal" (0) or "2px"
    let currentSpacing = parseFloat(bodyStyles.letterSpacing);
    if (isNaN(currentSpacing)) currentSpacing = 0;

    // 6. Detect Font Family
    // We check the classList because AppSidebar adds classes like "className"
    // OR we check the computed font-family string.
    const fontLabel = sessionStorage.getItem("selectedFontLabel") || "Sans";
    const bionicEnabled = sessionStorage.getItem("bionicMode") === "true";

    generateSmartPDF({
        title: savedName,
        sourceUrl: "Uploaded PDF",
        summary: summary,
        segments: segments,
        settings: {
            fontLabel: fontLabel,
            fontSize: currentFontSize,
            lineHeight: currentLineHeight,
            letterSpacing: currentSpacing,
            bionicEnabled: bionicEnabled
        }
    });
  };
  // --- 4. AUDIO SYSTEM ---
  const fetchAudioBlob = async (text: string) => {
    try {
        const res = await fetch(`/api/tts?text=${encodeURIComponent(text)}&voice=${voice}&speed=${speed}`);
        const data = await res.json();
        if (data.base64Chunks?.[0]) {
            const byteChars = atob(data.base64Chunks[0].base64);
            const byteNums = new Array(byteChars.length);
            for (let i = 0; i < byteChars.length; i++) byteNums[i] = byteChars.charCodeAt(i);
            return URL.createObjectURL(new Blob([new Uint8Array(byteNums)], { type: 'audio/mp3' }));
        }
    } catch (e) { console.error("Fetch failed", e); }
    return null;
  };

  const handlePlay = async (index: number) => {
    if (!segments[index]) return;
    let src = audioCache.current[index];
    if (!src) {
        setIsBuffering(true);
        src = await fetchAudioBlob(segments[index].simplified) || "";
        audioCache.current[index] = src;
        setIsBuffering(false);
    }
    if (src && audioRef.current) {
        audioRef.current.src = src;
        audioRef.current.play();
        setIsPlaying(true);
        const nextIdx = index + 1;
        if (segments[nextIdx] && !audioCache.current[nextIdx]) {
            fetchAudioBlob(segments[nextIdx].simplified).then(url => { if (url) audioCache.current[nextIdx] = url; });
        }
    }
  };

  const togglePlayPause = () => {
    if (isPlaying) { audioRef.current?.pause(); setIsPlaying(false); }
    else if (audioRef.current?.src && !audioRef.current.ended) { audioRef.current.play(); setIsPlaying(true); }
    else handlePlay(currentSentenceIndex);
  };

  const changeSentence = (newIndex: number) => {
    if (newIndex < 0 || newIndex >= segments.length) return;
    const wasPlaying = isPlaying || (audioRef.current && !audioRef.current.paused);
    setCurrentSentenceIndex(newIndex);
    if (wasPlaying) handlePlay(newIndex); else setIsPlaying(false);
  };

  // --- BOT LOGIC ---

  // 1. Speak the Response (Strict Stop & Restart)
  // --- BOT LOGIC ---

  // 1. Speak the Response (With Cancellation Check)
  const speakBotResponse = async (text: string) => {
    // A. SETUP & CANCEL OLD
    const myId = ++botGenId.current; // Increment ID: "I am request #5"
    
    window.speechSynthesis.cancel();
    if (audioRef.current) audioRef.current.pause();
    
    if ((window as any).botAudio) {
        (window as any).botAudio.pause();
        (window as any).botAudio = null;
    }

    setIsBotThinking(true); 
    setIsBotSpeaking(false);

    try {
        // Fetch audio with current settings
        const res = await fetch(`/api/tts?text=${encodeURIComponent(text)}&voice=${voice}&speed=${speed}`);
        const data = await res.json();

        // B. THE MAGIC CHECK
        // If the user changed voice while we were waiting, 'botGenId' will be higher (e.g., #6).
        // If myId (#5) !== botGenId.current (#6), we stop here.
        if (myId !== botGenId.current) return;

        if (data.base64Chunks?.[0]) {
            const byteChars = atob(data.base64Chunks[0].base64);
            const byteNums = new Array(byteChars.length);
            for (let i = 0; i < byteChars.length; i++) byteNums[i] = byteChars.charCodeAt(i);
            const blob = new Blob([new Uint8Array(byteNums)], { type: 'audio/mp3' });
            const url = URL.createObjectURL(blob);

            const audio = new Audio(url);
            
            audio.onplay = () => { 
                setIsBotThinking(false);
                setIsBotSpeaking(true); 
                setIsBotPaused(false); 
            };
            audio.onended = () => { 
                setIsBotSpeaking(false); 
                setIsBotPaused(false); 
            };
            audio.onpause = () => { 
                if (audio.currentTime > 0 && !audio.ended) {
                    setIsBotPaused(true);
                    setIsBotSpeaking(false);
                }
            };
            
            (window as any).botAudio = audio; 
            audio.play();
        }
    } catch (e) {
        console.error("Bot TTS Error", e);
        setIsBotThinking(false);
    }
  };

  // 2. Audio Controls
  const toggleBotAudio = () => {
    const audio = (window as any).botAudio;
    if (!audio) {
        // If no audio exists, replay the last response
        if (botResponse) speakBotResponse(botResponse);
        return;
    }

    if (audio.paused) {
      audio.play();
      setIsBotPaused(false);
      setIsBotSpeaking(true);
    } else {
      audio.pause();
      setIsBotPaused(true);
      setIsBotSpeaking(false);
    }
  };

  const stopBotAudio = () => {
    const audio = (window as any).botAudio;
    if (audio) {
        audio.pause();
        audio.currentTime = 0; // Reset to start
    }
    setIsBotSpeaking(false);
    setIsBotPaused(false);
  };

  // 3. API Call
  const fetchBotAnswer = async (question: string) => {
    setIsBotThinking(true);
    setLastQuestion(question);
    try {
        // Stop main player if it's running
        if (isPlaying && audioRef.current) {
            audioRef.current.pause();
            setIsPlaying(false);
        }

        const res = await fetch("/api/ai-process", {
            method: "POST",
            body: JSON.stringify({ 
                mode: "chat", 
                inputText: question, 
                // Context is crucial: we pass the simplified text so the bot knows what you are reading
                context: segments.map(s => s.simplified).join(" ") 
            })
        });
        const { answer } = await res.json();
        setBotResponse(answer);
        speakBotResponse(answer);
    } catch (e) {
        console.error("Bot Error", e);
        setIsBotThinking(false);
    }
  };

  // 4. Voice Input Handler
  // Global variable to track the active recognition instance
  const recognitionRef = useRef<any>(null);

  const handleVoiceChat = () => {
    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SpeechRecognition) return alert("Browser does not support voice input.");

    // 1. HARD RESET: specific fix for the "stuck" issue
    if (recognitionRef.current) {
        try {
            recognitionRef.current.abort(); // aggressive stop
        } catch (e) {
            // Ignore errors during abort
        }
        recognitionRef.current = null;
    }

    // 2. Stop audio
    window.speechSynthesis.cancel();
    if (audioRef.current) audioRef.current.pause();

    // 3. Setup New Instance
    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;

    // Save reference so we can kill it later if needed
    recognitionRef.current = recognition;

    setIsListening(true);

    // --- UPDATED TIMER: Reduced to 5 seconds for snappier reset ---
    const safetyTimer = setTimeout(() => {
        if (recognitionRef.current === recognition) {
            recognition.abort(); // This triggers 'aborted' error, which we catch below
            setIsListening(false);
            recognitionRef.current = null;
        }
    }, 5000);

    recognition.onstart = () => console.log("Mic active");

    recognition.onresult = (event: any) => {
        clearTimeout(safetyTimer);
        const transcript = event.results[0][0].transcript;
        setIsListening(false);
        recognitionRef.current = null; 
        fetchBotAnswer(transcript);
    };

    recognition.onerror = (event: any) => {
        clearTimeout(safetyTimer);
        
        // --- THE FIX: FILTER OUT "NO-SPEECH" AND "ABORTED" ---
        // These are normal operating states, not code breaks.
        if (event.error === 'no-speech' || event.error === 'aborted') {
            console.log("Mic status:", event.error); // Log as info, not error
            setIsListening(false);
            recognitionRef.current = null;
            return; // Exit without showing the red console error
        }

        // Only log REAL errors (like permission denied)
        console.error("Mic Error:", event.error);
        
        setIsListening(false);
        recognitionRef.current = null; 
        
        if (event.error === 'not-allowed') alert("Microphone access blocked.");
    };

    recognition.onend = () => {
        clearTimeout(safetyTimer);
        setIsListening(false);
    };

    try {
        recognition.start();
    } catch (e) {
        // Silent catch if start fails (e.g. rapid clicking)
        setIsListening(false);
        recognitionRef.current = null;
    }
  };

  // --- 5. UNIFIED STYLE HELPER (The Fix) ---
  const getUnifiedStyle = (index: number, confidence: number) => {
    const isActive = index === currentSentenceIndex;
    const isLowConfidence = confidenceMode && confidence < 70;
    const isMedConfidence = confidenceMode && confidence < 90;

    // Base Style: Box shape, smooth cloning, padding
    let base = "inline decoration-clone py-1 rounded px-1 transition-colors duration-300 ";

    if (isActive) {
        // ACTIVE STATE: Big Border Box
        if (isLowConfidence) return base + "bg-red-100 border-b-2 border-red-400 text-red-900";
        if (isMedConfidence) return base + "bg-yellow-100 border-b-2 border-yellow-400 text-yellow-900";
        // Default Active (Blue)
        return base + "bg-blue-100 border-b-2 border-blue-400 text-blue-900";
    } else {
        // INACTIVE STATE: Subtle Backgrounds
        if (isLowConfidence) return base + "bg-red-50 text-gray-900 cursor-help";
        if (isMedConfidence) return base + "bg-yellow-50 text-gray-900 cursor-help";
        // Default Inactive (Hover only)
        return base + "hover:bg-gray-100 text-gray-800 border-b-2 border-transparent";
    }
  };

  return (
    <TooltipProvider>
    <div className="h-screen grid grid-cols-[1.5fr_3fr_3fr] gap-4 p-4 relative">
      
      {/* GLOBAL OVERLAY (IRLEN) */}
      <div className="absolute inset-0 z-50 pointer-events-none mix-blend-multiply" style={{ backgroundColor: overlay.color }} />
      <audio ref={audioRef} onEnded={() => setIsPlaying(false)} />

      {/* --- COL 1: SETTINGS SIDEBAR --- */}
      <div className="border-2 p-4 rounded-xl bg-white overflow-y-auto relative z-40">
        <div className="mb-8">
            <MagicText tag="h2" text="Adjustments" className="font-bold text-[1.8em]" />
        </div>
        <div className="space-y-6">
            
            {/* 1. DIFFICULTY */}
            <div>
                <Label className="text-[1.2em] font-bold mb-2 block">
                    <MagicText text="Difficulty" />
                </Label>
                <RadioGroup value={level} onValueChange={setLevel}>
                    {["mild", "moderate", "severe"].map(l => (
                        <div key={l} className="flex items-center space-x-2">
                            <RadioGroupItem value={l} id={l} />
                            <Label htmlFor={l} className="capitalize text-[1em]">
                                <MagicText text={l} />
                            </Label>
                        </div>
                    ))}
                </RadioGroup>
            </div>

            {/* 2. CONFIDENCE TOGGLE */}
            <div className="pt-6 border-t">
                 <label className="flex items-center gap-3 cursor-pointer group">
                    <input type="checkbox" checked={confidenceMode} onChange={e => setConfidenceMode(e.target.checked)} className="w-5 h-5 accent-black" />
                    <div className="flex flex-col">
                        <span className="text-[1.1em] font-bold flex items-center gap-2">
                            <ShieldCheck size={18} className={confidenceMode ? "text-green-600" : "text-gray-400"}/> 
                            <MagicText text="AI Confidence" />
                        </span>
                        <span className="text-xs text-gray-500">
                            <MagicText text="Highlight hallucinations" />
                        </span>
                    </div>
                 </label>
            </div>

            {/* 3. IRLEN OVERLAYS */}
            <div className="pt-6 border-t">
                <Label className="text-[1.1em] font-bold mb-2 flex items-center gap-2">
                    <Layers size={18}/> 
                    <MagicText text="Irlen Overlays" />
                </Label>
                <div className="flex gap-2 flex-wrap">
                    {OVERLAYS.map((o) => (
                        <button
                            key={o.value}
                            onClick={() => setOverlay(o)}
                            className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 flex items-center justify-center text-[10px] font-bold ${overlay.value === o.value ? "border-black scale-110" : "border-gray-200"}`}
                            style={{ backgroundColor: o.value === 'none' ? 'white' : o.color.replace('0.2', '0.5') }}
                            title={o.name}
                        >
                            {o.value === 'none' && <MagicText text="OFF" />}
                        </button>
                    ))}
                </div>
            </div>

            {/* 5. FOCUS MODE */}
            <div className="pt-6 border-t">
                 <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={sentenceFocusMode} onChange={e => setSentenceFocusMode(e.target.checked)} className="w-5 h-5 accent-black" />
                    <span className="text-[1.1em] font-bold">
                        <MagicText text="Focus Mode" />
                    </span>
                 </label>
            </div>
            
            {/* 6. VOICE & SPEED */}
            <div className="pt-6 border-t space-y-4">
                 <div className="flex justify-between items-center">
                    <Label className="text-[1.1em] font-bold flex items-center gap-2">
                        <Mic size={18}/> 
                        <MagicText text="Narrator Voice" />
                    </Label>
                 </div>
                 <Select value={voice} onValueChange={setVoice}>
                    <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a voice" />
                    </SelectTrigger>
                    <SelectContent>
                        {VOICES.map(v => (
                            <SelectItem key={v.id} value={v.id}>
                                <MagicText text={v.name} />
                            </SelectItem>
                        ))}
                    </SelectContent>
                 </Select>

                 <Label className="text-[1.1em] font-bold block pt-2">
                    <MagicText text={`Audio Speed: ${speed}x`} />
                 </Label>
                 <Slider min={0.5} max={2} step={0.25} value={[speed]} onValueChange={v => setSpeed(v[0])} />
            </div>
        </div>
      </div>

      {/* --- COL 2: REFINED TEXT --- */}
      <div className="border-2 p-6 rounded-xl bg-white flex flex-col relative h-full z-40">
        <div className="flex justify-between items-center mb-6">
            <MagicText tag="h2" text="Refined Text" className="font-bold text-[2em]" />
            {/* NEW DOWNLOAD BUTTON */}
            <Button 
                onClick={handleDownload}
                className="gap-2 bg-black text-white hover:opacity-80"
                disabled={segments.length === 0 || isGeneratingPdf}
            >
                {isGeneratingPdf ? <Loader2 className="animate-spin" size={18} /> : <Download size={18} />}
                <span>{isGeneratingPdf ? "Generating..." : "Download PDF"}</span>
            </Button>
        </div>

        <div className="flex-grow overflow-y-auto mb-24 space-y-6 text-[1.1em] leading-loose">
            {isLoadingAI ? (
                <div className="animate-pulse text-gray-400">
                    <MagicText text="Verifying accuracy..." />
                </div>
            ) : sentenceFocusMode ? (
                // FOCUS MODE VIEW
                <div>
                     <div className={`p-6 rounded-2xl border-l-4 shadow-sm min-h-[150px] flex items-center transition-colors duration-500 ${
                         confidenceMode && (segments[currentSentenceIndex]?.confidence || 100) < 70 
                         ? "bg-red-50 border-red-400" 
                         : confidenceMode && (segments[currentSentenceIndex]?.confidence || 100) < 90
                         ? "bg-yellow-50 border-yellow-400"
                         : "bg-white border-blue-400" /* Default clean style */
                     }`}>
                        <div className={`font-medium text-[1.4em] ${
                            confidenceMode && (segments[currentSentenceIndex]?.confidence || 100) < 70 ? "text-red-900" : "text-gray-900"
                        }`}>
                            <MagicText tag="span" text={segments[currentSentenceIndex]?.simplified || ""} />
                        </div>
                     </div>
                     
                     <MagicText 
                        className="text-[0.9em] text-gray-400 mt-2 text-center"
                        text={`Sentence ${currentSentenceIndex + 1} of ${segments.length}`} 
                     />
                     
                     {confidenceMode && (segments[currentSentenceIndex]?.confidence || 100) < 70 && (
                        <p className="text-red-500 text-sm mt-2 flex items-center gap-2 justify-center">
                            <AlertTriangle size={14}/> 
                            <MagicText tag="span" text="Low confidence: Check original source." />
                        </p>
                     )}
                </div>
            ) : (
                // STANDARD VIEW - UNIFIED STYLE
                <div className="text-justify">
                    {segments.map((seg, i) => {
                        // 1. Determine the ONE Unified Style for this segment
                        const segmentStyle = getUnifiedStyle(i, seg.confidence);
                        const needsTooltip = confidenceMode && seg.confidence < 90;

                        // 2. Wrap content based on tooltip necessity
                        const content = (
                            <span 
                                key={i} 
                                className={segmentStyle}
                            >
                                <MagicText tag="span" text={seg.simplified} />
                                {/* Trailing space ensures sentences don't fuse */}
                                {" "} 
                            </span>
                        );

                        if (needsTooltip) {
                           return (
                               <Tooltip key={i}>
                                 <TooltipTrigger asChild>
                                    {content}
                                 </TooltipTrigger>
                                 <TooltipContent className="max-w-[300px] bg-black text-white p-3 text-sm z-[60]">
                                    <MagicText className="font-bold text-yellow-400 mb-1" text="Original Text:" />
                                    <MagicText text={`"${seg.original}"`} className="text-gray-200"/>
                                    <MagicText className="text-xs text-gray-400 mt-2" text={`Confidence: ${seg.confidence}%`} />
                                 </TooltipContent>
                               </Tooltip>
                           );
                        }
                        
                        return content;
                    })}
                </div>
            )}
        </div>

        {/* --- FLOATING PLAYER --- */}
         <div className="absolute bottom-6 left-6 right-6 bg-white border-2 shadow-xl p-4 rounded-full flex justify-center items-center gap-6 z-10">
            <Button variant="ghost" size="icon" onClick={() => changeSentence(currentSentenceIndex - 1)}>
                <SkipBack size={28} />
            </Button>
            <Button size="icon" className="h-14 w-14 rounded-full shadow-lg" onClick={togglePlayPause} disabled={isBuffering}>
                {isBuffering ? <Loader2 className="animate-spin" /> : isPlaying ? <Pause size={32} /> : <Play size={32} className="ml-1" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => changeSentence(currentSentenceIndex + 1)}>
                <SkipForward size={28} />
            </Button>
        </div>
      </div>

      {/* --- COL 3: SUMMARY --- */}
      <div className="border-2 p-6 rounded-xl bg-white overflow-y-auto z-40">
         <div className="mb-6">
            <MagicText tag="h2" text="Summary" className="font-bold text-[2em]" />
         </div>
         <div className="text-[1.1em] font-medium text-gray-700">
            {summary ? <MagicText text={summary} /> : <MagicText text="Loading summary..." />}
         </div>
      </div>
      {/* --- BOT INTERFACE --- */}
      <div className="fixed bottom-8 right-8 z-[100] flex flex-col items-end gap-4 pointer-events-auto">
        
        {/* Response Bubble */}
        {(botResponse || isBotThinking) && (
            <div className="bg-white border-2 border-black p-4 rounded-2xl shadow-2xl max-w-sm relative animate-in slide-in-from-bottom-4 duration-300">
                
                {/* Close Button */}
                <button 
                    onClick={() => { 
                        setBotResponse(""); 
                        stopBotAudio(); 
                    }} 
                    className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full p-1 border-2 border-white shadow-sm hover:bg-red-600 transition-colors"
                >
                    <X size={14} />
                </button>

                {/* Content */}
                {isBotThinking ? (
                    <div className="flex items-center gap-3 text-gray-500 py-2 px-1">
                        <Loader2 className="animate-spin text-blue-500" size={20} />
                        <span className="font-medium">Thinking...</span>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {/* The Text */}
                        <div className="max-h-[200px] overflow-y-auto pr-2">
                            <MagicText text={botResponse} className="text-[1.1em] font-medium leading-relaxed" />
                        </div>
                        
                        {/* Audio Controls */}
                        <div className="flex items-center gap-2 pt-2 border-t mt-2">
                             {/* Play/Pause */}
                             <Button 
                                variant="outline" size="sm" 
                                onClick={toggleBotAudio}
                                className="h-8 gap-2 bg-gray-50 hover:bg-gray-100"
                             >
                                {isBotSpeaking ? <Pause size={14}/> : <Play size={14}/>}
                                <span>{isBotSpeaking ? "Pause" : isBotPaused ? "Resume" : "Play"}</span>
                             </Button>

                             {/* Replay */}
                             <Button 
                                variant="ghost" size="icon" className="h-8 w-8 text-gray-500" 
                                onClick={() => speakBotResponse(botResponse)}
                                title="Replay Audio"
                             >
                                <RotateCcw size={14} />
                             </Button>
                            
                             <div className="flex-grow" />

                             {/* Regenerate (Re-ask same question) */}
                             <Button 
                                variant="ghost" size="sm" className="h-8 gap-1 text-gray-500 text-xs"
                                onClick={() => fetchBotAnswer(lastQuestion)}
                             >
                                <MessageSquare size={14} />
                                <span>Regenerate</span>
                             </Button>
                        </div>
                    </div>
                )}
            </div>
        )}

        {/* Main Microphone Trigger */}
        <Button 
            onClick={handleVoiceChat}
            disabled={isBotThinking}
            className={`h-20 w-20 rounded-full shadow-2xl border-4 border-white transition-all duration-300 z-[110] ${
                isListening 
                ? "bg-red-500 hover:bg-red-600 scale-110 animate-pulse" 
                : "bg-black hover:bg-gray-800 hover:scale-105"
            }`}
        >
            {isListening ? (
                <Loader2 className="animate-spin text-white" size={32} /> 
            ) : (
                <Mic size={36} className="text-white" />
            )}
        </Button>
      </div>
    </div>
    </TooltipProvider>
  );
}