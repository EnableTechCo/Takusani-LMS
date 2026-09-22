import type { Metadata } from "next";
import { Geist_Mono, Instrument_Sans, Newsreader } from "next/font/google";
import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { StickyInsets } from "@/components/shell/sticky-insets";
import { IconSprite } from "@/components/ui/icons";
import { ToastProvider } from "@/components/ui/toast";
import { parseTheme, THEME_COOKIE } from "@/lib/theme";
import "./globals.css";

const serif = Newsreader({ subsets: ["latin"], variable: "--font-newsreader", display: "swap" });
const sans = Instrument_Sans({ subsets: ["latin"], variable: "--font-instrument-sans", display: "swap" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Takusani LMS", template: "%s · Takusani LMS" },
  description:
    "Learning delivery, assessment, moderation, appeals and statutory records for an accredited training programme.",
};

// The theme comes from the appearance cookie (ThemeControl), so the page renders in it without a flash.
export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <html lang="en-ZA" data-theme={theme} className={`${serif.variable} ${sans.variable} ${mono.variable}`}>
      <body>
        <IconSprite />
        <StickyInsets />
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
