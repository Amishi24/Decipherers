import type { Metadata } from "next";
import "./globals.css";
import localFont from "next/font/local";
import { Analytics } from "@vercel/analytics/react";

const dyslexiaFont = localFont({
  src: "../../public/fonts/OpenDyslexic-Regular.woff2", 
  variable: "--font-dyslexic",
});

export const metadata: Metadata = {
  title: "Decipher.IO",
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
        // Sidebar theme logic relies on this class, but the Sidebar component itself is gone
        className={`${dyslexiaFont.variable} antialiased bg-[#d3efd7] text-[#1F2933]`}
      >
        {children}
        <Analytics />
      </body>
    </html>
  );
}