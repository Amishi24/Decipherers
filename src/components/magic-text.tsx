"use client";

import { useEffect, useState } from "react";
import { toBionic } from "@/lib/bionic";

interface MagicTextProps {
  text: string;
  className?: string;
  tag?: "p" | "h1" | "h2" | "h3" | "span" | "div";
}

export default function MagicText({ text, className = "", tag = "p" }: MagicTextProps) {
  const [bionicMode, setBionicMode] = useState(false);

  useEffect(() => {
    // 1. Check initial state
    const isBionic = sessionStorage.getItem("bionicMode") === "true";
    setBionicMode(isBionic);

    // 2. Listen for changes from the Sidebar
    const handleStorageChange = () => {
      setBionicMode(sessionStorage.getItem("bionicMode") === "true");
    };

    window.addEventListener("bionicModeChanged", handleStorageChange);
    return () => window.removeEventListener("bionicModeChanged", handleStorageChange);
  }, []);

  const content = bionicMode ? toBionic(text) : text;
  const Tag = tag as any;

  // FIX: We split the return into two distinct cases to satisfy React's strict rules.
  if (bionicMode) {
    return (
      <Tag
        className={className}
        dangerouslySetInnerHTML={{ __html: content }}
      />
    );
  }

  return (
    <Tag className={className}>
      {text}
    </Tag>
  );
}