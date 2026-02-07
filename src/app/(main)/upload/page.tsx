"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import FileUploader from "@/components/ui/FileUploader";
import { Loader2 } from "lucide-react"; 
import { extractTextFromPdf } from "@/lib/pdf-loader"; 

export default function UploadPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [statusText, setStatusText] = useState(""); 

  const handleFileProcess = async (file: File) => {
    if (!file) return;
    
    setIsLoading(true);
    setStatusText("Analyzing PDF...");

    try {
      const text = await extractTextFromPdf(file);

      if (!text || text.length < 10) {
        throw new Error("Could not extract readable text from this file.");
      }

      sessionStorage.setItem("pdfText", text);
      
      setStatusText("Refining text...");
      router.push("/refined");

    } catch (error) {
      console.error("Processing failed:", error);
      alert("Failed to read the PDF. It might be empty or corrupted.");
      setIsLoading(false);
    }
  };

  return (
    // Outer div transparent so Sidebar theme background shows through
    <div className="flex justify-center items-center w-full h-screen transition-colors duration-300">
      <Card className="w-2/3 max-w-2xl border-2 bg-[#FFFAEF] text-[#020402] shadow-xl">
        
        <CardHeader className="text-start">
          {/* Scalable font size [2.5em] instead of fixed text-4xl */}
          <CardTitle className="text-[2.5em] pb-4 font-bold">
            {isLoading ? "Processing..." : "Upload File"}
          </CardTitle>
          {/* Scalable font size [1.2em] */}
          <CardDescription className="text-[1.2em] opacity-90">
            {isLoading 
              ? statusText 
              : "We'll handle the rest! Supports scanned & digital PDFs."}
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col justify-center items-center min-h-[300px]">
          {isLoading ? (
            <div className="flex flex-col items-center gap-4 animate-in fade-in">
              <Loader2 size={64} className="animate-spin text-orange-500" />
              <p className="text-[1.2em] text-gray-500 font-medium">
                This may take a few seconds...
              </p>
            </div>
          ) : (
            <FileUploader onFileRead={handleFileProcess} />
          )}
        </CardContent>

        <CardFooter className="flex justify-center pb-8">
            {!isLoading && (
                <p className="text-[0.9em] text-gray-400">
                    Processed locally in your browser for privacy.
                </p>
            )}
        </CardFooter>

      </Card>
    </div>
  );
}