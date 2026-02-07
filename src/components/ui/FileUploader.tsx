"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type FileUploaderProps = {
  // We just pass the raw File object up to the parent
  onFileRead: (file: File) => void;
};

export default function FileUploader({ onFileRead }: FileUploaderProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleSubmit = () => {
    if (selectedFile && onFileRead) {
      // Pass the file to the parent (upload/page.tsx) to handle OCR/Loading/Redirect
      onFileRead(selectedFile);
    }
  };

  return (
    <div className="grid w-full max-w-xl items-center gap-6">
      <div className="grid w-full items-center gap-1.5">
        <Input
          id="file"
          type="file"
          accept="application/pdf"
          onChange={handleFileChange}
          className="cursor-pointer bg-white file:text-blue-600 file:font-semibold"
        />
      </div>

      <Button 
        onClick={handleSubmit} 
        disabled={!selectedFile} 
        className="w-full text-lg py-6"
      >
        Let's Go!
      </Button>
    </div>
  );
}