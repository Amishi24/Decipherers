"use client";
import { useEffect, useState } from "react";

interface FocusOverlayProps {
  enabled: boolean;
  opacity: number; // 0 to 1
}

export default function FocusOverlay({
  enabled,
  opacity,
}: FocusOverlayProps) {
  const [y, setY] = useState(0);

  useEffect(() => {
    // Center the band on the screen initially
    setY(window.innerHeight / 2);

    const handleMouseMove = (e: MouseEvent) => {
      // Option A: Band follows mouse (Good for reading)
      setY(e.clientY);
    };

    // Option B: Band stays in center (Uncomment if preferred)
    // const handleScroll = () => setY(window.innerHeight / 2);

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  if (!enabled) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      {/* Top Dimmed Area */}
      <div
        className="absolute left-0 right-0 top-0 transition-all duration-75 ease-out"
        style={{
          height: Math.max(0, y - 60), // 60px is half band height
          backgroundColor: `rgba(0,0,0,${opacity})`,
        }}
      />

      {/* The Clear "Focus" Band */}
      <div
        className="absolute left-0 right-0 transition-all duration-75 ease-out border-y-2 border-white/20"
        style={{
          top: Math.max(0, y - 60),
          height: 120, // Band height
          backgroundColor: "transparent", 
          boxShadow: "0 0 20px 10px rgba(0,0,0,0.1) inset"
        }}
      />

      {/* Bottom Dimmed Area */}
      <div
        className="absolute left-0 right-0 bottom-0 transition-all duration-75 ease-out"
        style={{
          top: Math.max(0, y + 60),
          backgroundColor: `rgba(0,0,0,${opacity})`,
        }}
      />
    </div>
  );
}