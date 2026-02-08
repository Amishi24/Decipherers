"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { FontSelector } from "./ui/fontSelector";
import { Geist, Geist_Mono, Atkinson_Hyperlegible } from "next/font/google";
import localFont from "next/font/local";
import { useEffect, useState } from "react";
import { Slider } from "./ui/slider";
import { Button } from "./ui/button";

// --- Font Definitions ---
const geistSans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });
const atkinsonHyperlegible = Atkinson_Hyperlegible({ subsets: ["latin"], weight: ["400", "700"] });
const openDyslexia = localFont({ src: "../../public/fonts/OpenDyslexic-Regular.woff2" });
const verdana = localFont({ src: "../../public/fonts/Verdana-Bold.ttf" });

type AppSidebarProps = {
  focusMode: boolean;
  setFocusMode: (val: boolean) => void;
  focusOpacity: number;
  setFocusOpacity: (val: number) => void;
};

export function AppSidebar({
  focusMode,
  setFocusMode,
  focusOpacity,
  setFocusOpacity,
}: AppSidebarProps) {
  // UI State
  const [font, setFont] = useState("");
  const [spacing, setSpacing] = useState(2);
  const [lineHeight, setLineHeight] = useState(2.0);
  const [wordSpacing, setWordSpacing] = useState(4);
  const [fontSize, setFontSize] = useState(18);
  const [bgColor, setBgColor] = useState("#d3efd7");
  const [bionicEnabled, setBionicEnabled] = useState(false);

  // Constants
  const fonts = [
    { label: "Sans", value: geistSans.className },
    { label: "Mono", value: geistMono.className },
    { label: "Dyslexia", value: openDyslexia.className },
    { label: "Atkinson", value: atkinsonHyperlegible.className },
    { label: "Verdana", value: verdana.className },
  ];

  const bgColors = [
    { label: "Green", value: "#d3efd7" },
    { label: "Cream", value: "#FFF8E1" },
    { label: "Peach", value: "#FDEBD0" },
    { label: "Blue", value: "#D6EAF8" },
    { label: "Yellow", value: "#FFF9C4" },
    { label: "White", value: "#FFFFFF" },
  ];

  // --- Effects to apply styles globally ---
  useEffect(() => {
    document.body.style.setProperty("letter-spacing", `${spacing}px`, "important");
  }, [spacing]);

  useEffect(() => {
    document.body.style.setProperty("word-spacing", `${wordSpacing}px`, "important");
  }, [wordSpacing]);

  useEffect(() => {
    document.body.style.setProperty("line-height", `${lineHeight}`, "important");
  }, [lineHeight]);

  useEffect(() => {
    document.body.style.setProperty("font-size", `${fontSize}px`, "important");
  }, [fontSize]);

  useEffect(() => {
    document.body.style.backgroundColor = bgColor;
  }, [bgColor]);

  // Handle Font Class Switching
  useEffect(() => {
    document.body.classList.remove(
      geistSans.className, geistMono.className, atkinsonHyperlegible.className,
      openDyslexia.className, verdana.className
    );
    if (font) document.body.classList.add(font);
    const selectedFont = fonts.find(f => f.value === font);
    if (selectedFont) {
        sessionStorage.setItem("selectedFontLabel", selectedFont.label);
    }
  }, [font]);

  // Handle Bionic Mode Broadcast
  useEffect(() => {
    sessionStorage.setItem("bionicMode", bionicEnabled ? "true" : "false");
    window.dispatchEvent(new Event("bionicModeChanged"));
  }, [bionicEnabled]);

  return (
    <Sidebar>
      <SidebarHeader>
        <h2 className="text-lg font-bold px-4 pt-4">Decipher Settings</h2>
      </SidebarHeader>

      <SidebarContent className="px-2">
        {/* --- 1. Font & Layout --- */}
        <SidebarGroup>
          <SidebarGroupLabel>Typography</SidebarGroupLabel>
          <SidebarGroupContent className="space-y-4 px-2">
            <FontSelector fonts={fonts} onChange={setFont} />
            
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Size ({fontSize}px)</span>
              <Slider min={14} max={32} step={1} value={[fontSize]} onValueChange={(v) => setFontSize(v[0])} />
            </div>

            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Letter Spacing</span>
              <Slider min={0} max={8} step={0.5} value={[spacing]} onValueChange={(v) => setSpacing(v[0])} />
            </div>

             <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Line Height</span>
              <Slider min={1.2} max={3.5} step={0.1} value={[lineHeight]} onValueChange={(v) => setLineHeight(v[0])} />
            </div>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* --- 2. Color --- */}
        <SidebarGroup>
          <SidebarGroupLabel>Theme</SidebarGroupLabel>
          <SidebarGroupContent className="px-2 flex gap-2 flex-wrap">
            {bgColors.map((c) => (
              <button
                key={c.value}
                onClick={() => setBgColor(c.value)}
                className={`w-6 h-6 rounded-full border-2 transition-transform ${bgColor === c.value ? "border-black scale-110" : "border-gray-300"}`}
                style={{ backgroundColor: c.value }}
                title={c.label}
              />
            ))}
          </SidebarGroupContent>
        </SidebarGroup>

        {/* --- 3. Bionic Reading --- */}
        <SidebarGroup>
          <SidebarGroupLabel>Assistance</SidebarGroupLabel>
          <SidebarGroupContent className="px-2 space-y-4">
            <Button
              variant={bionicEnabled ? "default" : "outline"}
              className="w-full justify-between"
              onClick={() => setBionicEnabled(!bionicEnabled)}
            >
              Bionic Reading <span>{bionicEnabled ? "ON" : "OFF"}</span>
            </Button>

            {/* Focus Band Toggle */}
            <div className="space-y-3 pt-2 border-t">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm font-medium">Focus Band</span>
                <input
                  type="checkbox"
                  checked={focusMode}
                  onChange={(e) => setFocusMode(e.target.checked)}
                  className="h-4 w-4 accent-black"
                />
              </label>

              {focusMode && (
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Band Opacity</span>
                  <Slider
                    min={0.3} max={0.95} step={0.05}
                    value={[focusOpacity]}
                    onValueChange={(v) => setFocusOpacity(v[0])}
                  />
                </div>
              )}
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter />
    </Sidebar>
  );
}