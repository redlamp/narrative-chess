import type { Metadata } from "next";
import { Fraunces, Newsreader, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";
import { SiteHeader } from "@/components/site-header";
import { ThemeProvider } from "@/components/theme-provider";

// Display — characterful serif with optical-sizing, soft, and wonk axes.
// Used for headings + the wordmark italic.
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  axes: ["SOFT", "WONK", "opsz"],
});

// Body — magazine-grade variable serif.
const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-body",
  axes: ["opsz"],
});

// Mono — technical voice (clocks, move log, IDs, system metadata, boxed CHESS).
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Narrative Chess",
  description: "Games that tell stories.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "h-full",
        "antialiased",
        fraunces.variable,
        newsreader.variable,
        jetbrainsMono.variable,
      )}
    >
      <body className="min-h-full flex flex-col font-body">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <SiteHeader />
          {children}
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
