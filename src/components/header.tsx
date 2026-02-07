"use client";

import Image from "next/image";
import { SidebarTrigger } from "@/components/ui/sidebar";
import Link from "next/link";

export default function Header() {
  return (
    <header className="sticky top-0 z-40 w-full bg-[#9de2ac] border-b border-black/5">
      <div className="flex items-center gap-4 px-6 py-3">
        <SidebarTrigger />
        
        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          {/* Ensure you have a logo.png in public folder, or remove Image */}
          <div className="w-8 h-8 relative">
             <Image
                src="/logo.png"
                alt="Logo"
                fill
                className="object-contain"
             />
          </div>
          <h1 className="text-2xl font-bold text-black tracking-tight">
            Decipher AI
          </h1>
        </Link>
      </div>
    </header>
  );
}