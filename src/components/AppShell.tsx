"use client";

import { useState } from "react";
import FocusOverlay from "@/components/FocusOverlay";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar"; // This is the merged sidebar we made earlier
import Header from "@/components/header";

export default function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  // Shared State for Focus Mode
  // We lift this state up here so the Sidebar controls it, but the Overlay (global) renders it.
  const [focusMode, setFocusMode] = useState(false);
  const [focusOpacity, setFocusOpacity] = useState(0.5);

  return (
    <SidebarProvider>
      {/* 1. The Sidebar (Controls) */}
      <AppSidebar
        focusMode={focusMode}
        setFocusMode={setFocusMode}
        focusOpacity={focusOpacity}
        setFocusOpacity={setFocusOpacity}
      />

      {/* 2. Main Content Area */}
      <div className="flex flex-col flex-1 min-h-screen transition-all duration-300 ease-in-out">
        <Header />
        
        {/* 3. The Page Content */}
        <main className="flex-1 relative">
           {children}
        </main>
      </div>

      {/* 4. The Visual Overlay (Renders on top of everything when enabled) */}
      <FocusOverlay enabled={focusMode} opacity={focusOpacity} />

    </SidebarProvider>
  );
}