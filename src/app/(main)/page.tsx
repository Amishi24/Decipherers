"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import MagicText from "@/components/magic-text"; 

export default function Home() {
  return (
    // Transparent background so the Sidebar theme shows through
    <div className="flex flex-col min-h-screen px-10 py-10 transition-colors duration-300">

      {/* ================= PDF UPLOAD SECTION ================= */}
      <section className="flex items-center justify-center min-h-[50vh]">
        <div className="flex items-center gap-16 max-w-6xl w-full">
          
          {/* TEXT */}
          <div className="flex flex-col gap-6 max-w-xl">
            <MagicText 
              tag="h3" 
              text="A Gift for Creative Thinkers" 
              className="text-[2.5em] font-bold" 
            />

            <div className="space-y-4">
              <MagicText 
                text="Convert text from PDF into a dyslexia-friendly format." 
                className="text-[1.1em] opacity-90" 
              />
              <MagicText 
                text="Making it more readable and easily understandable." 
                className="text-[1.1em] opacity-90" 
              />
            </div>

            <Button asChild className="rounded-full px-8 py-6 text-[1.1em] w-fit shadow-lg hover:scale-105 transition-transform mt-4">
              <Link href="/upload">Upload PDF</Link>
            </Button>
          </div>

          {/* IMAGE - Clean container with no borders */}
          <div className="relative flex items-center justify-center">
             <Image 
                src="/card.png" 
                width={400} 
                height={400} 
                alt="Upload PDF" 
                className="object-contain drop-shadow-xl"
             />
          </div>
        </div>
      </section>

      {/* ================= EXTENSION SECTION ================= */}
      <section className="flex items-center justify-center min-h-[50vh]">
        <div className="flex items-center gap-16 max-w-6xl w-full">
          
           {/* IMAGE */}
           <div className="relative flex items-center justify-center">
             <Image 
                src="/image.png" 
                width={280} 
                height={280} 
                alt="Extension" 
                className="object-contain drop-shadow-xl"
             />
          </div>

          <div className="flex flex-col gap-6 max-w-xl text-right items-end">
            <MagicText 
              tag="h3" 
              text="Download Extension" 
              className="text-[2.5em] font-bold" 
            />

            <MagicText 
              text="Simple-to-use open source dyslexia reader helper." 
              className="text-[1.1em] opacity-90" 
            />

            <Button className="rounded-full px-8 py-6 text-[1.1em] w-fit bg-blue-600 hover:bg-blue-700 shadow-lg text-white mt-4">
              Add to Chrome
            </Button>
          </div>
        </div>
      </section>

      {/* ================= CONTACT SECTION ================= */}
      <section className="flex items-center justify-center min-h-[50vh]">
        <div className="flex items-center gap-16 max-w-6xl w-full">
          
          <div className="flex flex-col gap-6 max-w-xl">
            <MagicText 
              tag="h3" 
              text="Contact a Counsellor" 
              className="text-[2.5em] font-bold" 
            />

            <div className="space-y-1 text-[1.1em] opacity-90">
                <MagicText text="For emotional support," />
                <MagicText text="Coping strategies, and" />
                <MagicText text="Building self-esteem." />
            </div>

            <Button className="rounded-full px-8 py-6 text-[1.1em] w-fit bg-orange-500 hover:bg-orange-600 shadow-lg text-white mt-4">
              Connect
            </Button>
          </div>

          {/* IMAGE */}
          <div className="relative flex items-center justify-center">
             <Image 
                src="/Counsellor.png" 
                width={380} 
                height={380} 
                alt="Counsellor" 
                className="object-contain drop-shadow-xl"
             />
          </div>
        </div>
      </section>

    </div>
  );
}