import type { Metadata } from "next";
import "./globals.css";
import localFont from "next/font/local";
import { Analytics } from "@vercel/analytics/react";
import AppShell from "@/components/AppShell";

const dyslexiaFont = localFont({
  src: "../../public/fonts/OpenDyslexic-Regular.woff2", 
  variable: "--font-dyslexic",
});

// Updated Metadata from your file
export const metadata: Metadata = {
  title: "Decipher AI",
  description: "Make reading simple and accessible for everyone.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        // Updated Background Color to match your new design (#d3efd7)
        className={`${dyslexiaFont.variable} antialiased bg-[#d3efd7] text-[#1F2933]`}
      >
        {/* We keep AppShell because it connects the Sidebar to the Focus Overlay */}
        <AppShell>{children}</AppShell>
        <Analytics />
      </body>
    </html>
  );
}