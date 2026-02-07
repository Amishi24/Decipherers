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
    </div>
    </TooltipProvider>
  );
}