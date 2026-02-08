import jsPDF from "jspdf";

// ==========================================
// 1. FONT CONFIGURATION
// ==========================================
const FONT_CONFIG: Record<string, { regular: string; bold: string; pdfName: string }> = {
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

const BUILTIN_FONT_MAP: Record<string, string> = {
  Sans: "helvetica",
  Mono: "courier",
  Serif: "times",
};

// Async Font Fetcher
async function fetchFontAsBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    if (buffer.byteLength < 12) return null;
    
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  } catch (e) {
    console.warn(`Font fetch error: ${url}`, e);
    return null;
  }
}

interface PDFGenProps {
  title: string;
  sourceUrl?: string;
  summary: string;
  segments: { simplified: string }[];
  settings: {
    fontLabel: string;
    fontSize: number;
    lineHeight: number;
    letterSpacing: number;
    bionicEnabled: boolean;
  };
}

// ==========================================
// 2. MAIN GENERATOR
// ==========================================
export const generateSmartPDF = async ({
  title,
  sourceUrl,
  summary,
  segments,
  settings
}: PDFGenProps) => {
  // Init PDF with 'pt' (Points) for precise text layout
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const usableWidth = pageWidth - (margin * 2);

  // --- A. LOAD & REGISTER FONTS ---
  let pdfFontName = "helvetica";
  let hasBold = true;

  if (BUILTIN_FONT_MAP[settings.fontLabel]) {
    pdfFontName = BUILTIN_FONT_MAP[settings.fontLabel];
    // Built-ins always have bold
  } else if (FONT_CONFIG[settings.fontLabel]) {
    const config = FONT_CONFIG[settings.fontLabel];
    const regB64 = await fetchFontAsBase64(config.regular);
    
    if (regB64) {
      // Register Regular
      doc.addFileToVFS(config.pdfName + "-Regular.ttf", regB64);
      doc.addFont(config.pdfName + "-Regular.ttf", config.pdfName, "normal");
      pdfFontName = config.pdfName;

      // Register Bold
      const boldB64 = await fetchFontAsBase64(config.bold);
      if (boldB64) {
        doc.addFileToVFS(config.pdfName + "-Bold.ttf", boldB64);
        doc.addFont(config.pdfName + "-Bold.ttf", config.pdfName, "bold");
      } else {
        hasBold = false; // Fallback if no bold file
      }
    }
  }

  // Helper to safely switch styles using the CORRECT font
  const setStyle = (style: "normal" | "bold", size: number, color: [number, number, number]) => {
    const safeStyle = (style === "bold" && !hasBold) ? "normal" : style;
    try { doc.setFont(pdfFontName, safeStyle); } 
    catch { doc.setFont("helvetica", safeStyle); } // Fallback
    
    doc.setFontSize(size);
    doc.setTextColor(...color);
    
    // Apply letter spacing if supported (cleaner look)
    if (typeof (doc as any).setCharSpace === "function") {
      (doc as any).setCharSpace(settings.letterSpacing * 0.4);
    }
  };

  // --- B. CURSOR MANAGEMENT ---
  let cursorY = 0;
  const ensureSpace = (needed: number) => {
    if (cursorY + needed > pageHeight - margin) {
      doc.addPage();
      cursorY = margin + 20;
    }
  };

  // --- C. TEXT RENDERING ENGINE (Unified) ---
  // This handles Headings, Summary, and Content identically
  const writeContentBlock = (text: string, isBold: boolean, fontSize: number, useBionic: boolean) => {
    const lineHeight = fontSize * settings.lineHeight;
    
    setStyle(isBold ? "bold" : "normal", fontSize, [40, 40, 40]);

    if (useBionic) {
      // Use Bionic Renderer
      writeBionicBlock(
        doc, text, margin, usableWidth, fontSize, lineHeight,
        pdfFontName, (settings.letterSpacing * 0.4), hasBold,
        ensureSpace, () => cursorY, (val) => cursorY = val
      );
    } else {
      // Standard Renderer
      const lines = doc.splitTextToSize(text, usableWidth);
      for (const line of lines) {
        ensureSpace(lineHeight);
        doc.text(line, margin, cursorY);
        cursorY += lineHeight;
      }
    }
  };

  // ============================
  // START DRAWING PDF
  // ============================

  // 1. BRAND HEADER (Fixed Style)
  doc.setFillColor(157, 226, 172); // Green
  doc.rect(0, 0, pageWidth, 50, "F");
  
  doc.setFont("helvetica", "normal"); // Keep brand font standard
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text("Decipher.IO | Accessibility Document", margin, 30);
  cursorY = 90;

  // 2. DOCUMENT TITLE (Uses Custom Font!)
  setStyle("bold", 24, [20, 20, 20]);
  const titleLines = doc.splitTextToSize(title, usableWidth);
  doc.text(titleLines, margin, cursorY);
  cursorY += (titleLines.length * 28) + 10;

  // 3. METADATA
  setStyle("normal", 10, [100, 100, 100]);
  doc.text(`Font: ${settings.fontLabel} | Bionic: ${settings.bionicEnabled ? "ON" : "OFF"}`, margin, cursorY);
  cursorY += 15;
  
  // Divider
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, cursorY, pageWidth - margin, cursorY);
  cursorY += 30;

  // 4. EXECUTIVE SUMMARY (Now uses Custom Font + Bionic + No Box)
  if (summary) {
    // Heading
    setStyle("bold", 14, [0, 0, 0]);
    doc.text("Executive Summary", margin, cursorY);
    cursorY += 20;

    // Content (Uses unified writer)
    // We use a slightly smaller font for summary, but apply Bionic logic
    const summarySize = Math.max(settings.fontSize * 0.70, 10);
    writeContentBlock(summary, false, summarySize, settings.bionicEnabled);
    
    cursorY += 30; // Gap after summary
    
    // Second Divider to separate Summary from Content
    doc.setDrawColor(220, 220, 220);
    doc.line(margin, cursorY, pageWidth - margin, cursorY);
    cursorY += 30;
  }

  // 5. REFINED CONTENT
  setStyle("bold", 14, [0, 0, 0]);
  doc.text("Refined Content", margin, cursorY);
  cursorY += 20;

  const contentSize = Math.max(settings.fontSize * 0.75, 11);
  
  for (const seg of segments) {
    ensureSpace(contentSize * settings.lineHeight);
    writeContentBlock(seg.simplified, false, contentSize, settings.bionicEnabled);
    cursorY += (contentSize * 0.8); // Paragraph gap
  }

  // 6. FOOTER
  const pageCount = doc.getNumberOfPages();
  for(let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "italic"); // Footer stays simple
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin, pageHeight - 20, { align: "right" });
  }

  // SAVE
  const cleanTitle = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  doc.save(`decipher_${cleanTitle}.pdf`);
};

// ==========================================
// 3. BIONIC LOGIC
// ==========================================
function writeBionicBlock(
  doc: jsPDF, text: string, x: number, width: number, size: number, 
  leading: number, fontName: string, charSpacing: number, hasBold: boolean,
  checkSpace: (n: number) => void, getY: () => number, setY: (v: number) => void
) {
  const words = text.split(/\s+/).filter(Boolean);
  let line: string[] = [];

  const flushLine = () => {
    if (line.length === 0) return;
    
    checkSpace(leading);
    const y = getY();
    let curX = x;

    line.forEach((word, i) => {
      // Calculate Bold Split
      const len = word.length;
      let boldLen = 0;
      if (len === 1) boldLen = 1;
      else if (len <= 3) boldLen = 1;
      else if (len <= 6) boldLen = Math.ceil(len * 0.5); // Slightly stronger bionic
      else boldLen = Math.ceil(len * 0.4);

      const boldPart = word.slice(0, boldLen);
      const normalPart = word.slice(boldLen);

      // 1. Draw Bold Part
      try { doc.setFont(fontName, hasBold ? "bold" : "normal"); } catch {}
      doc.setFontSize(size);
      doc.text(boldPart, curX, y);
      curX += doc.getTextWidth(boldPart);

      // 2. Draw Normal Part
      if (normalPart) {
        try { doc.setFont(fontName, "normal"); } catch {}
        doc.setFontSize(size);
        doc.text(normalPart, curX, y);
        curX += doc.getTextWidth(normalPart);
      }

      // 3. Draw Space
      if (i < line.length - 1) {
        curX += doc.getTextWidth(" ");
      }
    });

    setY(y + leading);
    line = [];
  };

  for (const word of words) {
    const testLine = [...line, word].join(" ");
    try { doc.setFont(fontName, "normal"); } catch {} // Measure using normal weight
    
    if (doc.getTextWidth(testLine) > width && line.length > 0) {
      flushLine();
    }
    line.push(word);
  }
  flushLine();
}