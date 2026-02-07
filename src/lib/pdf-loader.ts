import * as pdfjsLib from "pdfjs-dist";
import { createWorker } from "tesseract.js";

// 1. Set the worker source to a stable Cloudflare CDN matching version 3.11.174
// This prevents the "worker not found" and "version mismatch" errors
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

export async function extractTextFromPdf(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  
  // Load the PDF
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  
  let fullText = "";
  let totalChars = 0;

  console.log(`PDF Loaded. Pages: ${pdf.numPages}`);

  // 2. Try Standard Text Extraction
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item: any) => item.str).join(" ");
    
    fullText += pageText + "\n";
    totalChars += pageText.length;
  }

  // 3. Fallback to OCR if text is basically empty
  // (Less than 50 chars usually means it's a scanned image)
  if (totalChars < 50) {
    console.log("Text is missing or too short. Switching to OCR mode...");
    return await performOCR(pdf);
  }

  return fullText.trim();
}

// Helper: OCR Logic
async function performOCR(pdf: any): Promise<string> {
  const worker = await createWorker("eng");
  let ocrText = "";

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1.5 });

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    if (context) {
      await page.render({ canvasContext: context, viewport }).promise;
      const blob = await new Promise<Blob | null>(r => canvas.toBlob(r));
      
      if (blob) {
        const { data: { text } } = await worker.recognize(blob);
        ocrText += text + "\n";
      }
    }
  }

  await worker.terminate();
  return ocrText;
}