"use client";
import { useState, useEffect, useRef } from "react";
import { Play, Pause, SkipBack, SkipForward, Loader2, Settings, FileText, Sparkles, Type, Palette, Mic, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toBionic } from "@/lib/bionic";

// --- CONSTANTS ---
const THEMES = [
  { name: "Green", value: "green", bg: "#d3efd7", text: "#1F2933" },
  { name: "Yellow", value: "yellow", bg: "#fdf6d8", text: "#1F2933" },
  { name: "Blue", value: "blue", bg: "#dbeafe", text: "#1e3a8a" },
  { name: "Cream", value: "cream", bg: "#fdfbf7", text: "#333333" },
  { name: "Dark", value: "dark", bg: "#1f2937", text: "#f3f4f6" },
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

const VOICES = [
  { id: "en-US-Journey-F", name: "Journey (Female)" },
  { id: "en-US-Journey-D", name: "Journey (Male)" },
  { id: "en-US-Studio-O", name: "Studio (Female)" },
  { id: "en-US-Studio-M", name: "Studio (Male)" },
];

export default function SidebarPage() {
  // --- STATE ---
  const [sourceText, setSourceText] = useState("");
  const [rephrased, setRephrased] = useState("");
  const [summary, setSummary] = useState("");
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [activeTab, setActiveTab] = useState("read");

  // Settings
  const [level, setLevel] = useState("moderate");
  const [sentenceFocusMode, setSentenceFocusMode] = useState(false);
  const [bionicMode, setBionicMode] = useState(false);
  const [speed, setSpeed] = useState(1.0);
  const [voice, setVoice] = useState("en-US-Journey-F"); 

  // Visuals
  const [theme, setTheme] = useState(THEMES[0]);
  const [overlay, setOverlay] = useState(OVERLAYS[0]); // NEW: Overlay State
  const [font, setFont] = useState("OpenDyslexic");
  const [fontSize, setFontSize] = useState(18);
  const [letterSpacing, setLetterSpacing] = useState(0);
  const [lineHeight, setLineHeight] = useState(1.6);

  // Audio State
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCache = useRef<Record<number, string>>({});

  // Parsing State
  const [sentences, setSentences] = useState<string[]>([]);
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(0);

  // --- 1. APPLY VISUAL SETTINGS ---
  const containerStyle = {
    fontFamily: font === "OpenDyslexic" ? "var(--font-dyslexic)" : font,
    fontSize: `${fontSize}px`,
    letterSpacing: `${letterSpacing}px`,
    lineHeight: lineHeight,
    backgroundColor: theme.bg,
    color: theme.text,
  };

  // --- 2. CLEAR CACHE ON SETTINGS CHANGE ---
  useEffect(() => {
    audioCache.current = {}; 
    if (isPlaying && sentences.length > 0) {
        handlePlay(currentSentenceIndex);
    }
  }, [speed, voice]); 

  // --- 3. LISTENER FOR EXTENSION DATA ---
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "DECIPHER_TEXT") {
        setSourceText(event.data.text);
      }
    };
    window.addEventListener("message", handleMessage);

    const timer = setTimeout(() => {
        if (window.parent) window.parent.postMessage({ type: "REQUEST_READ" }, "*");
    }, 500);

    return () => {
        window.removeEventListener("message", handleMessage);
        clearTimeout(timer);
    };
  }, []);

  // --- 4. AI PROCESSING ---
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
        } catch (e) { console.error("AI Error", e); } 
        finally { setIsLoadingAI(false); }
    };
    fetchAI();
  }, [sourceText, level]);

  // --- 5. SENTENCE PARSING ---
  useEffect(() => {
    const textToSplit = rephrased || sourceText;
    if (!textToSplit) return;
    
    const cleanText = textToSplit
        .replace(/^\d+\.\s*/gm, "")
        .replace(/\n\d+\.\s*/g, " ") 
        .replace(/[*•-]\s*/g, ""); 

    const split = cleanText.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [cleanText];
    const cleanSentences = split.map(s => s.trim()).filter(s => s.length > 3);
    
    setSentences(cleanSentences);
    setCurrentSentenceIndex(0);
    audioCache.current = {}; 
    
    if (cleanSentences.length > 0) {
        fetchAudioBlob(cleanSentences[0]).then(url => { if (url) audioCache.current[0] = url; });
    }
  }, [rephrased, sourceText]);

  // --- AUDIO LOGIC ---
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
    } catch (e) { console.error(e); }
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
            fetchAudioBlob(sentences[nextIdx]).then(url => { if (url) audioCache.current[nextIdx] = url; });
        }
    }
  };

  const togglePlayPause = () => {
    if (isPlaying) { audioRef.current?.pause(); setIsPlaying(false); }
    else if (audioRef.current?.src && !audioRef.current.ended) { audioRef.current.play(); setIsPlaying(true); }
    else handlePlay(currentSentenceIndex);
  };

  const changeSentence = (newIndex: number) => {
    if (newIndex < 0 || newIndex >= sentences.length) return;
    const wasPlaying = isPlaying || (audioRef.current && !audioRef.current.paused);
    setCurrentSentenceIndex(newIndex);
    if (wasPlaying) handlePlay(newIndex); else setIsPlaying(false);
  };

  const renderText = (text: string) => {
    if (bionicMode) return <span dangerouslySetInnerHTML={{ __html: toBionic(text) }} />;
    return text;
  };

  return (
    <div className="h-screen flex flex-col transition-colors duration-300 overflow-hidden relative" style={containerStyle}>
      
      {/* --- GLOBAL OVERLAY (IRLEN SUPPORT) --- */}
      {/* Pointer events none ensures you can click 'through' the color tint */}
      <div 
        className="absolute inset-0 z-50 pointer-events-none mix-blend-multiply" 
        style={{ backgroundColor: overlay.color }}
      />

      <audio ref={audioRef} onEnded={() => setIsPlaying(false)} />

      {/* --- HEADER --- */}
      <div className="p-4 border-b flex justify-between items-center bg-black/5 shadow-sm relative z-40">
        <h1 className="font-bold text-xl">Decipher.io</h1>
        {isLoadingAI && <Loader2 className="animate-spin h-5 w-5 opacity-70" />}
      </div>

      {!sourceText ? (
        <div className="flex-1 flex flex-col justify-center items-center p-8 text-center opacity-60 z-40">
           <FileText className="w-16 h-16 mb-4 opacity-30" />
           <p className="text-lg mb-6">Open a website and click below!</p>
           <Button 
             onClick={() => window.parent?.postMessage({ type: "REQUEST_READ" }, "*")}
             className="bg-primary text-primary-foreground hover:opacity-90"
           >
             Read This Page
           </Button>
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden relative z-40">
          
          <TabsList className="grid w-full grid-cols-3 rounded-none border-b h-12 bg-transparent">
            <TabsTrigger value="settings" className="data-[state=active]:bg-black/10"><Settings className="w-4 h-4 mr-2"/> Set</TabsTrigger>
            <TabsTrigger value="read" className="data-[state=active]:bg-black/10"><FileText className="w-4 h-4 mr-2"/> Read</TabsTrigger>
            <TabsTrigger value="summary" className="data-[state=active]:bg-black/10"><Sparkles className="w-4 h-4 mr-2"/> Sum</TabsTrigger>
          </TabsList>

          <TabsContent value="settings" className="p-5 overflow-y-auto flex-1 space-y-8">
            
            {/* THEME */}
            <div className="space-y-3">
                <Label className="flex items-center gap-2 text-sm uppercase tracking-wider opacity-70 font-bold"><Palette size={14}/> Theme</Label>
                <div className="flex gap-3">
                    {THEMES.map((t) => (
                        <button
                            key={t.value}
                            onClick={() => setTheme(t)}
                            className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${theme.value === t.value ? "border-black scale-110" : "border-transparent"}`}
                            style={{ backgroundColor: t.bg }}
                            title={t.name}
                        />
                    ))}
                </div>
            </div>

            {/* NEW: OVERLAY (IRLEN) SECTION */}
            <div className="space-y-3 pt-4 border-t border-black/10">
                <Label className="flex items-center gap-2 text-sm uppercase tracking-wider opacity-70 font-bold"><Layers size={14}/> Irlen Overlays</Label>
                <div className="flex gap-3 flex-wrap">
                    {OVERLAYS.map((o) => (
                        <button
                            key={o.value}
                            onClick={() => setOverlay(o)}
                            className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 flex items-center justify-center text-[10px] font-bold ${overlay.value === o.value ? "border-black scale-110" : "border-gray-200"}`}
                            style={{ backgroundColor: o.value === 'none' ? 'white' : o.color.replace('0.2', '0.5') }} // Show stronger color in button
                            title={o.name}
                        >
                            {o.value === 'none' && "OFF"}
                        </button>
                    ))}
                </div>
            </div>

            {/* TYPOGRAPHY */}
            <div className="space-y-4 pt-4 border-t border-black/10">
                <Label className="flex items-center gap-2 text-sm uppercase tracking-wider opacity-70 font-bold"><Type size={14}/> Typography</Label>
                
                <Select value={font} onValueChange={setFont}>
                  <SelectTrigger className="w-full bg-white/50 border-black/20">
                    <SelectValue placeholder="Select Font" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OpenDyslexic">OpenDyslexic</SelectItem>
                    <SelectItem value="Arial">Arial</SelectItem>
                    <SelectItem value="Verdana">Verdana</SelectItem>
                    <SelectItem value="Comic Sans MS">Comic Sans</SelectItem>
                  </SelectContent>
                </Select>

                <div className="space-y-2">
                   <div className="flex justify-between text-xs opacity-70"><span>Size</span><span>{fontSize}px</span></div>
                   <Slider min={12} max={32} step={1} value={[fontSize]} onValueChange={v => setFontSize(v[0])} />
                </div>
                
                <div className="space-y-2">
                   <div className="flex justify-between text-xs opacity-70"><span>Line Height</span><span>{lineHeight}</span></div>
                   <Slider min={1} max={2.5} step={0.1} value={[lineHeight]} onValueChange={v => setLineHeight(v[0])} />
                </div>
            </div>

            {/* AI / INTELLIGENCE SETTINGS */}
            <div className="space-y-4 pt-4 border-t border-black/10">
                <Label className="flex items-center gap-2 text-sm uppercase tracking-wider opacity-70 font-bold"><Sparkles size={14}/> Intelligence</Label>
                
                <RadioGroup value={level} onValueChange={setLevel} className="flex justify-between">
                    {["mild", "moderate", "severe"].map(l => (
                        <div key={l} className="flex items-center space-x-1">
                            <RadioGroupItem value={l} id={l} />
                            <Label htmlFor={l} className="capitalize text-sm">{l}</Label>
                        </div>
                    ))}
                </RadioGroup>

                <div className="flex items-center justify-between pt-2">
                   <Label>Focus Mode</Label>
                   <input type="checkbox" checked={sentenceFocusMode} onChange={e => setSentenceFocusMode(e.target.checked)} className="w-4 h-4 accent-black" />
                </div>

                <div className="flex items-center justify-between">
                   <Label>Bionic Reading</Label>
                   <input type="checkbox" checked={bionicMode} onChange={e => setBionicMode(e.target.checked)} className="w-4 h-4 accent-black" />
                </div>

                <div className="pt-2">
                    <Label className="text-xs opacity-70 mb-2 block">Narrator Voice</Label>
                    <Select value={voice} onValueChange={setVoice}>
                        <SelectTrigger className="w-full bg-white/50 border-black/20">
                            <SelectValue placeholder="Select Voice" />
                        </SelectTrigger>
                        <SelectContent>
                            {VOICES.map(v => (
                                <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                 <div className="space-y-2 pt-2">
                   <div className="flex justify-between text-xs opacity-70"><span>Audio Speed</span><span>{speed}x</span></div>
                   <Slider min={0.5} max={2} step={0.25} value={[speed]} onValueChange={v => setSpeed(v[0])} />
                </div>
            </div>
          </TabsContent>

          {/* --- TAB 2: READ --- */}
          <TabsContent value="read" className="flex-1 flex flex-col overflow-hidden relative">
             <div className="flex-grow overflow-y-auto p-4 pb-24 space-y-6">
                {isLoadingAI ? <div className="animate-pulse opacity-60">Refining text...</div> : 
                 sentenceFocusMode ? (
                    <div className="p-4 rounded-xl border-l-4 shadow-sm bg-black/5 border-black/20">
                        <p className="font-medium">
                             {renderText(sentences[currentSentenceIndex] || "")}
                        </p>
                    </div>
                 ) : (
                    <div className="text-justify">
                    {sentences.map((s, i) => (
                        <span key={i} className={`mr-1 transition-colors ${i === currentSentenceIndex ? "bg-yellow-300/50 rounded px-1" : ""}`}>
                            {renderText(s)}{" "}
                        </span>
                    ))}
                    </div>
                 )
                }
             </div>

             {/* Player Controls */}
             <div className="absolute bottom-4 left-4 right-4 bg-white/90 backdrop-blur border shadow-xl p-2 rounded-full flex justify-center items-center gap-4 z-10">
                <Button variant="ghost" size="icon" onClick={() => changeSentence(currentSentenceIndex - 1)}>
                    <SkipBack className="w-5 h-5"/>
                </Button>
                <Button size="icon" className="h-10 w-10 rounded-full shadow-md" onClick={togglePlayPause} disabled={isBuffering}>
                    {isBuffering ? <Loader2 className="animate-spin p-1" /> : isPlaying ? <Pause className="w-5 h-5"/> : <Play className="ml-1 w-5 h-5" />}
                </Button>
                <Button variant="ghost" size="icon" onClick={() => changeSentence(currentSentenceIndex + 1)}>
                    <SkipForward className="w-5 h-5"/>
                </Button>
             </div>
          </TabsContent>

          {/* --- TAB 3: SUMMARY --- */}
          <TabsContent value="summary" className="p-4 overflow-y-auto flex-1">
             <div className="font-medium opacity-90">
                {summary ? renderText(summary) : isLoadingAI ? "Generating summary..." : "No summary available."}
             </div>
          </TabsContent>

        </Tabs>
      )}
    </div>
  );
}