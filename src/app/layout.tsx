import type { Metadata } from "next";
import { Geist_Mono, Open_Sans, Outfit } from "next/font/google";
import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { StickyInsets } from "@/components/shell/sticky-insets";
import { IconSprite } from "@/components/ui/icons";
import { INSTITUTION } from "@/config/institution";
import { ToastProvider } from "@/components/ui/toast";
import { parseTheme, THEME_COOKIE } from "@/lib/theme";
import "./globals.css";

// iNurture's typefaces: Outfit for titles and the wordmark, Open Sans for everything else.
const display = Outfit({ subsets: ["latin"], variable: "--font-outfit", display: "swap" });
const sans = Open_Sans({ subsets: ["latin"], variable: "--font-open-sans", display: "swap" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });

export const metadata: Metadata = {
  title: { default: INSTITUTION.product, template: `%s · ${INSTITUTION.product}` },
  description:
    "Learning delivery, assessment, moderation, appeals and statutory records for an accredited training programme.",
};

// The theme comes from the appearance cookie (ThemeControl), so the page renders in it without a flash.
export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <html lang="en-ZA" data-theme={theme} className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body>
        <IconSprite />
        <StickyInsets />
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
