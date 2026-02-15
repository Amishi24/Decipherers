// src/components/DownloadPDF.tsx
"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import jsPDF from "jspdf";

type Segment = {
  original: string;
  simplified: string;
  confidence: number;
};

interface DownloadPDFProps {
  segments: Segment[];
  summary: string;
}

// Custom fonts with VALID .ttf/.otf files
const FONT_CONFIG: Record<
  string,
  { regular: string; bold: string; pdfName: string }
> = {
  Dyslexia: {
    regular: "/fonts/OpenDyslexic-Regular.ttf",
    bold: "/fonts/OpenDyslexic-Bold.ttf",
    pdfName: "OpenDyslexic",
  },
  Atkinson: {
    regular: "/fonts/AtkinsonHyperlegible-Regular.ttf",
    bold: "/fonts/AtkinsonHyperlegible-Bold.ttf",
    pdfName: "AtkinsonHyperlegible",
  },
  Verdana: {
    regular: "/fonts/Verdana-Bold.ttf",
    bold: "/fonts/Verdana-Bold.ttf",
    pdfName: "VerdanaCustom",
  },
};

// Fonts that map to jsPDF built-in equivalents
const BUILTIN_FONT_MAP: Record<string, string> = {
  Sans: "helvetica",
  Mono: "courier",
};

async function fetchFontAsBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`Font fetch failed: ${url} (${res.status})`);
      return null;
    }
    const buffer = await res.arrayBuffer();

    if (buffer.byteLength < 12) {
      console.warn(`Font file too small: ${url}`);
      return null;
    }

    // Check for HTML (invalid font)
    const preview = new Uint8Array(buffer.slice(0, 16));
    const textDecoder = new TextDecoder();
    const header = textDecoder.decode(preview);
    if (header.includes("<!DO") || header.includes("<htm") || header.includes("<HT")) {
      console.warn(`Font is an HTML file, not a font: ${url}`);
      return null;
    }

    // Validate: TTF=0x00010000, true=0x74727565, OTTO=0x4F54544F, woff2=0x774F4632
    const view = new DataView(buffer);
    const sig = view.getUint32(0);
    const validSigs = [0x00010000, 0x74727565, 0x4f54544f];
    if (!validSigs.includes(sig)) {
      console.warn(`Unsupported font format for ${url}: 0x${sig.toString(16).toUpperCase()}`);
      return null;
    }

    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  } catch (e) {
    console.warn(`Font fetch error: ${url}`, e);
    return null;
  }
}

function getBodyStyles() {
  const style = document.body.style;
  return {
    fontSize: parseFloat(style.getPropertyValue("font-size")) || 18,
    letterSpacing: parseFloat(style.getPropertyValue("letter-spacing")) || 2,
    lineHeight: parseFloat(style.getPropertyValue("line-height")) || 2.0,
    wordSpacing: parseFloat(style.getPropertyValue("word-spacing")) || 4,
  };
}

export default function DownloadPDF({ segments, summary }: DownloadPDFProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  const generatePDF = async () => {
    setIsGenerating(true);

    try {
      const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 50;
      const usableWidth = pageWidth - margin * 2;

      const fontLabel = sessionStorage.getItem("selectedFontLabel") || "Sans";
      const bodyStyles = getBodyStyles();
      const bionicEnabled = sessionStorage.getItem("bionicMode") === "true";

      const baseFontSize = Math.min(Math.max(bodyStyles.fontSize * 0.75, 10), 24);
      const lineHeightMultiplier = Math.min(Math.max(bodyStyles.lineHeight, 1.4), 3.0);
      const charSpacing = Math.min(Math.max(bodyStyles.letterSpacing * 0.3, 0), 3);

      // --- Font Registration ---
      let pdfFontName = "helvetica";
      let hasBold = true;

      if (BUILTIN_FONT_MAP[fontLabel]) {
        // Use jsPDF built-in
        pdfFontName = BUILTIN_FONT_MAP[fontLabel];
        hasBold = true;
        console.log(`✅ Using built-in font: ${pdfFontName} (for "${fontLabel}")`);
      } else if (FONT_CONFIG[fontLabel]) {
        const config = FONT_CONFIG[fontLabel];

        // Register regular
        const regB64 = await fetchFontAsBase64(config.regular);
        if (regB64) {
          const regFile = config.pdfName + "-Regular.ttf";
          doc.addFileToVFS(regFile, regB64);
          doc.addFont(regFile, config.pdfName, "normal");
          pdfFontName = config.pdfName;
          console.log(`✅ Registered: ${config.pdfName} regular`);

          // Register bold
          const boldB64 = await fetchFontAsBase64(config.bold);
          if (boldB64) {
            const boldFile = config.pdfName + "-Bold.ttf";
            doc.addFileToVFS(boldFile, boldB64);
            doc.addFont(boldFile, config.pdfName, "bold");
            hasBold = true;
            console.log(`✅ Registered: ${config.pdfName} bold`);
          } else {
            hasBold = false;
            console.warn(`⚠️ No bold for ${config.pdfName}`);
          }
        } else {
          console.warn(`⚠️ Font "${fontLabel}" failed to load. Using Helvetica.`);
        }
      }

      // --- Safe font setter ---
      const setFont = (style: "normal" | "bold") => {
        const resolved = style === "bold" && !hasBold ? "normal" : style;
        try {
          doc.setFont(pdfFontName, resolved);
        } catch {
          pdfFontName = "helvetica";
          hasBold = true;
          doc.setFont("helvetica", resolved);
        }
      };

      // --- Cursor & pagination ---
      let cursorY = margin;

      const ensureSpace = (needed: number) => {
        if (cursorY + needed > pageHeight - margin) {
          doc.addPage();
          cursorY = margin;
        }
      };

      // --- Write a block of text ---
      const writeBlock = (
        text: string,
        size: number,
        bold = false,
        color: [number, number, number] = [30, 30, 30]
      ) => {
        setFont(bold ? "bold" : "normal");
        doc.setFontSize(size);
        doc.setTextColor(...color);
        if (typeof (doc as any).setCharSpace === "function") {
          (doc as any).setCharSpace(charSpacing);
        }

        const lineSpacing = size * lineHeightMultiplier;

        if (bionicEnabled) {
          writeBionicBlock(doc, text, margin, usableWidth, size, lineSpacing, pdfFontName, charSpacing, hasBold, ensureSpace, () => cursorY, (v: number) => { cursorY = v; });
        } else {
          const lines = doc.splitTextToSize(text, usableWidth);
          for (const line of lines) {
            ensureSpace(lineSpacing);
            doc.text(line, margin, cursorY);
            cursorY += lineSpacing;
          }
        }
      };

      // ===== BUILD THE PDF =====

      // Title
      ensureSpace(60);
      setFont("bold");
      doc.setFontSize(22);
      doc.setTextColor(20, 20, 20);
      doc.text("Refined Document", margin, cursorY);
      cursorY += 36;

      // Metadata
      setFont("normal");
      doc.setFontSize(9);
      doc.setTextColor(130, 130, 130);
      doc.text(
        `Font: ${fontLabel} | Size: ${bodyStyles.fontSize}px | Line Height: ${bodyStyles.lineHeight} | Spacing: ${bodyStyles.letterSpacing}px | Bionic: ${bionicEnabled ? "ON" : "OFF"}`,
        margin,
        cursorY
      );
      cursorY += 24;

      // Divider
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, cursorY, pageWidth - margin, cursorY);
      cursorY += 20;

      // Section: Refined Text
      ensureSpace(30);
      writeBlock("Refined Text", baseFontSize + 4, true, [10, 10, 10]);
      cursorY += 8;

      for (const seg of segments) {
        ensureSpace(baseFontSize * lineHeightMultiplier + 10);
        writeBlock(seg.simplified, baseFontSize, false, [40, 40, 40]);
        cursorY += 4;
      }

      // Section: Summary
      cursorY += 16;
      ensureSpace(50);
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, cursorY, pageWidth - margin, cursorY);
      cursorY += 20;

      writeBlock("Summary", baseFontSize + 4, true, [10, 10, 10]);
      cursorY += 8;

      if (summary) {
        writeBlock(summary, baseFontSize, false, [60, 60, 60]);
      }

      // Footer
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(160, 160, 160);
      doc.text("Generated by Decipherers • Dyslexia-friendly reading", margin, pageHeight - 30);

      doc.save("deciphered-document.pdf");
      console.log("✅ PDF downloaded");
    } catch (err) {
      console.error("PDF Generation Error:", err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Button
      onClick={generatePDF}
      disabled={isGenerating || segments.length === 0}
      variant="outline"
      className="gap-2"
    >
      {isGenerating ? (
        <>
          <Loader2 className="animate-spin" size={16} />
          Generating...
        </>
      ) : (
        <>
          <Download size={16} />
          Download PDF
        </>
      )}
    </Button>
  );
}

// ==========================================
// BIONIC BLOCK WRITER
// ==========================================
function writeBionicBlock(
  doc: jsPDF,
  text: string,
  marginLeft: number,
  usableWidth: number,
  fontSize: number,
  lineSpacing: number,
  fontName: string,
  charSpacing: number,
  hasBold: boolean,
  ensureSpace: (n: number) => void,
  getCursorY: () => number,
  setCursorY: (v: number) => void
) {
  const words = text.split(/\s+/).filter(Boolean);
  let lineWords: string[] = [];

  const flushLine = () => {
    if (lineWords.length === 0) return;
    const line = lineWords.join(" ");
    ensureSpace(lineSpacing);
    renderBionicLine(doc, line, marginLeft, getCursorY(), fontSize, fontName, charSpacing, hasBold);
    setCursorY(getCursorY() + lineSpacing);
    lineWords = [];
  };

  for (const word of words) {
    const testLine = [...lineWords, word].join(" ");

    // Measure with normal style for consistent width
    try { doc.setFont(fontName, "normal"); } catch { doc.setFont("helvetica", "normal"); }
    doc.setFontSize(fontSize);

    if (doc.getTextWidth(testLine) > usableWidth && lineWords.length > 0) {
      flushLine();
    }
    lineWords.push(word);
  }
  flushLine();
}

function renderBionicLine(
  doc: jsPDF,
  line: string,
  x: number,
  y: number,
  fontSize: number,
  fontName: string,
  charSpacing: number,
  hasBold: boolean
) {
  const words = line.split(/\s+/);
  let curX = x;

  const safeBold = () => {
    try { doc.setFont(fontName, hasBold ? "bold" : "normal"); }
    catch { doc.setFont("helvetica", "bold"); }
  };
  const safeNormal = () => {
    try { doc.setFont(fontName, "normal"); }
    catch { doc.setFont("helvetica", "normal"); }
  };

  for (let w = 0; w < words.length; w++) {
    const word = words[w];
    const len = word.length;
    let boldLen: number;
    if (len <= 3) boldLen = len;
    else if (len <= 6) boldLen = Math.ceil(len * 0.6);
    else boldLen = Math.ceil(len * 0.4);

    const boldPart = word.slice(0, boldLen);
    const normalPart = word.slice(boldLen);

    // Bold part
    safeBold();
    doc.setFontSize(fontSize);
    if (typeof (doc as any).setCharSpace === "function") (doc as any).setCharSpace(charSpacing);
    doc.text(boldPart, curX, y);
    curX += doc.getTextWidth(boldPart);

    // Normal part
    if (normalPart) {
      safeNormal();
      doc.setFontSize(fontSize);
      if (typeof (doc as any).setCharSpace === "function") (doc as any).setCharSpace(charSpacing);
      doc.text(normalPart, curX, y);
      curX += doc.getTextWidth(normalPart);
    }

    // Space
    if (w < words.length - 1) {
      safeNormal();
      curX += doc.getTextWidth(" ");
    }
  }
}