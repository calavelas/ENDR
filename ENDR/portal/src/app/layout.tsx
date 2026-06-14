import "./globals.css";
import type { Metadata } from "next";
import { JetBrains_Mono, Manrope } from "next/font/google";
import { ReactNode } from "react";

import { AppShell } from "./components/app-shell";
import { CreateStepProvider } from "./lib/create-step";
import { NarrativeProvider } from "./lib/narrative";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600", "700", "800"]
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["500", "600"]
});

export const metadata: Metadata = {
  title: "ENDR | Internal Developer Platform",
  description: "Modern ArgoCD-style read-only portal for ENDR"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${manrope.variable} ${jetbrainsMono.variable}`}>
        <NarrativeProvider>
          <CreateStepProvider>
            <AppShell>{children}</AppShell>
          </CreateStepProvider>
        </NarrativeProvider>
      </body>
    </html>
  );
}
