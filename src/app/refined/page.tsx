"use client";
import { useState, useEffect, useRef } from "react";
import { Play, Pause, SkipBack, SkipForward, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { toBionic } from "@/lib/bionic";

export default function Refined() {
  // --- STATE ---
  const [sourceText, setSourceText] = useState("");
  const [rephrased, setRephrased] = useState("");
  const [summary, setSummary] = useState("");
  const [level, setLevel] = useState("moderate");
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  
  // Sentence Mode State
  const [sentences, setSentences] = useState<string[]>([]);
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(0);
  const [sentenceFocusMode, setSentenceFocusMode] = useState(true);

  // Audio State
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [voice, setVoice] = useState("en-US-Journey-F");
  const [speed, setSpeed] = useState(1.0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  const audioCache = useRef<Record<number, string>>({});
  const [bionicMode, setBionicMode] = useState(false);

  // --- 1. INITIALIZATION ---
  useEffect(() => {
    const saved = sessionStorage.getItem("pdfText");
    if (saved) {
        setSourceText(saved);
        setBionicMode(sessionStorage.getItem("bionicMode") === "true");
    }
    const handleBionic = () => setBionicMode(sessionStorage.getItem("bionicMode") === "true");
    window.addEventListener("bionicModeChanged", handleBionic);
    return () => window.removeEventListener("bionicModeChanged", handleBionic);
  }, []);

  // --- 2. CLEAR CACHE ON SETTINGS CHANGE ---
  useEffect(() => {
    audioCache.current = {}; 
    if (isPlaying && sentences.length > 0) {
        handlePlay(currentSentenceIndex);
    }
  }, [speed, voice]);

  // --- 3. AI FETCHING ---
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
            if (data.rephrased) setRephrased(data.rephrased);
            if (data.summary) setSummary(data.summary);
        } catch (e) {
            console.error("AI Error", e);
        } finally {
            setIsLoadingAI(false);
        }
    };
    fetchAI();
  }, [sourceText, level]);

  // --- 4. SENTENCE PARSING ---
  useEffect(() => {
    const textToSplit = rephrased || sourceText;
    if (!textToSplit) return;
    
    const cleanText = textToSplit
        .replace(/^\d+\.\s*/gm, "")
        .replace(/\n\d+\.\s*/g, " ") 
        .replace(/[*•-]\s*/g, ""); 

    const split = cleanText.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [cleanText];
    
    const cleanSentences = split
        .map(s => s.trim())
        .filter(s => s.length > 3 && !/^\d+\.$/.test(s));
    
    setSentences(cleanSentences);
    setCurrentSentenceIndex(0);
    audioCache.current = {}; 
    
    if (cleanSentences.length > 0) {
        const preloadFirst = async () => {
             const url = await fetchAudioBlob(cleanSentences[0]);
             if (url) audioCache.current[0] = url;
        };
        preloadFirst();
    }
  }, [rephrased, sourceText]);

  // --- 5. AUDIO SYSTEM ---
  const fetchAudioBlob = async (text: string) => {
    try {
        const res = await fetch(`/api/tts?text=${encodeURIComponent(text)}&voice=${voice}&speed=${speed}`);
        const data = await res.json();
        if (data.base64Chunks?.[0]) {
            const byteChars = atob(data.base64Chunks[0].base64);
            const byteNums = new Array(byteChars.length);
            for (let i = 0; i < byteChars.length; i++) byteNums[i] = byteChars.charCodeAt(i);
            const blob = new Blob([new Uint8Array(byteNums)], { type: 'audio/mp3' });
            return URL.createObjectURL(blob);
        }
    } catch (e) {
        console.error("Fetch failed", e);
    }
    return null;
  };

  const handlePlay = async (index: number) => {
    if (!sentences[index]) return;

    let src = audioCache.current[index];

    if (!src) {
        setIsBuffering(true);
        src = await fetchAudioBlob(sentences[index]) || "";
        audioCache.current[index] = src;
        setIsBuffering(false);
    }

    if (src && audioRef.current) {
        audioRef.current.src = src;
        audioRef.current.play();
        setIsPlaying(true);

        const nextIdx = index + 1;
        if (sentences[nextIdx] && !audioCache.current[nextIdx]) {
            fetchAudioBlob(sentences[nextIdx]).then(url => {
                if (url) audioCache.current[nextIdx] = url;
            });
        }
    }
  };

  const togglePlayPause = () => {
    if (isPlaying) {
        audioRef.current?.pause();
        setIsPlaying(false);
    } else {
        if (audioRef.current?.src && !audioRef.current.ended) {
            audioRef.current.play();
            setIsPlaying(true);
        } else {
            handlePlay(currentSentenceIndex);
        }
    }
  };

  const changeSentence = (newIndex: number) => {
    if (newIndex < 0 || newIndex >= sentences.length) return;
    const wasPlaying = isPlaying || (audioRef.current && !audioRef.current.paused);
    setCurrentSentenceIndex(newIndex);
    if (wasPlaying) {
        handlePlay(newIndex);
    } else {
        setIsPlaying(false);
    }
  };

  const renderText = (text: string) => {
    if (bionicMode) return <span dangerouslySetInnerHTML={{ __html: toBionic(text) }} />;
    return text;
  };

  return (
    <div className="h-screen grid grid-cols-[1.5fr_3fr_3fr] gap-4 p-4">
      <audio ref={audioRef} onEnded={() => setIsPlaying(false)} />

      {/* --- COL 1: CONTROLS --- */}
      <div className="border-2 p-4 rounded-xl bg-white overflow-y-auto">
        <h2 className="font-bold text-[1.8em] mb-8">Adjustments</h2>
        
        <div className="space-y-6">
            <div>
                <Label className="text-[1.2em] font-bold mb-2 block">Difficulty</Label>
                <RadioGroup value={level} onValueChange={setLevel}>
                    {["mild", "moderate", "severe"].map(l => (
                        <div key={l} className="flex items-center space-x-2">
                            <RadioGroupItem value={l} id={l} />
                            <Label htmlFor={l} className="capitalize text-[1em]">{l}</Label>
                        </div>
                    ))}
                </RadioGroup>
            </div>

            <div className="pt-6 border-t">
                 <label className="flex items-center gap-3 cursor-pointer">
                    <input 
                        type="checkbox" 
                        checked={sentenceFocusMode} 
                        onChange={e => setSentenceFocusMode(e.target.checked)}
                        className="w-5 h-5 accent-black"
                    />
                    <span className="text-[1.1em] font-bold">Focus Mode</span>
                 </label>
            </div>
            
            <div className="pt-6 border-t space-y-4">
                 <Label className="text-[1.1em] font-bold">Audio Speed: {speed}x</Label>
                 <Slider min={0.5} max={2} step={0.25} value={[speed]} onValueChange={v => setSpeed(v[0])} />
            </div>
        </div>
      </div>

      {/* --- COL 2: REFINED TEXT --- */}
      <div className="border-2 p-6 rounded-xl bg-white flex flex-col relative h-full">
        <div className="flex justify-between items-center mb-6">
            <h2 className="font-bold text-[2em]">Refined Text</h2>
        </div>

        {/* Removed fixed leading-relaxed to respect sidebar Line Height */}
        <div className="flex-grow overflow-y-auto mb-24 space-y-4 text-[1.1em]">
            {isLoadingAI ? (
                <div className="animate-pulse text-gray-400">Processing text...</div>
            ) : sentenceFocusMode ? (
                <div>
                     <div className="bg-yellow-100/50 p-6 rounded-2xl border-l-4 border-yellow-400 shadow-sm min-h-[150px] flex items-center">
                        <p className="font-medium text-[1.4em] text-gray-900">
                            {renderText(sentences[currentSentenceIndex] || "")}
                        </p>
                     </div>
                     <p className="text-[0.9em] text-gray-400 mt-2 text-center">
                        Sentence {currentSentenceIndex + 1} of {sentences.length}
                     </p>
                </div>
            ) : (
                sentences.map((s, i) => (
                    <span key={i} className={`mr-1 ${i === currentSentenceIndex ? "bg-yellow-200" : ""}`}>
                        {renderText(s)}{" "}
                    </span>
                ))
            )}
        </div>

        {/* --- FLOATING PLAYER --- */}
        <div className="absolute bottom-6 left-6 right-6 bg-white border-2 shadow-xl p-4 rounded-full flex justify-center items-center gap-6 z-10">
            <Button variant="ghost" size="icon" onClick={() => changeSentence(currentSentenceIndex - 1)}>
                <SkipBack size={28} />
            </Button>
            
            <Button 
                size="icon" 
                className="h-14 w-14 rounded-full shadow-lg transition-transform hover:scale-105" 
                onClick={togglePlayPause}
                disabled={isBuffering}
            >
                {isBuffering ? (
                    <Loader2 className="animate-spin" /> 
                ) : isPlaying ? (
                    <Pause size={32} /> 
                ) : (
                    <Play size={32} className="ml-1" />
                )}
            </Button>

            <Button variant="ghost" size="icon" onClick={() => changeSentence(currentSentenceIndex + 1)}>
                <SkipForward size={28} />
            </Button>
        </div>
      </div>

      {/* --- COL 3: SUMMARY --- */}
      <div className="border-2 p-6 rounded-xl bg-white overflow-y-auto">
         <h2 className="font-bold text-[2em] mb-6">Summary</h2>
         <div className="text-[1.1em] font-medium text-gray-700">
            {summary ? renderText(summary) : "Loading summary..."}
         </div>
      </div>
    </div>
  );
}