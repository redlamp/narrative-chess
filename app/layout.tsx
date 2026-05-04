import type { Metadata } from "next";
import { Geist, Geist_Mono, Raleway, Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";
import { SiteHeader } from "@/components/site-header";

const interHeading = Inter({ subsets: ["latin"], variable: "--font-heading" });
const raleway = Raleway({ subsets: ["latin"], variable: "--font-sans" });
const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Narrative Chess",
  description: "Multiplayer chess with a story.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={cn(
        "h-full",
        "antialiased",
        geistSans.variable,
        geistMono.variable,
        "font-sans",
        raleway.variable,
        interHeading.variable,
      )}
    >
      <body className="min-h-full flex flex-col">
        <SiteHeader />
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
