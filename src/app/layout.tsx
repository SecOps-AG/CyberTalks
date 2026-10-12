import type { Metadata } from "next";
import Script from "next/script";
import { IBM_Plex_Mono, Orbitron } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { CommandPaletteProvider } from "@/components/CommandPaletteProvider";
import "./globals.css";

const orbitron = Orbitron({
  subsets: ["latin"],
  variable: "--font-orbitron",
  weight: ["500", "700"],
});

const ibm = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-ibm",
  weight: ["400", "500", "600"],
});

const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(
  /\/+$/,
  "",
);

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: "Cyber Talks",
    template: "%s — Cyber Talks",
  },
  description:
    "Cyber Talks: a searchable archive of cybersecurity conference talks from DEF CON, Black Hat, RSAC, and TROOPERS, with YouTube video and written summaries.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${orbitron.variable} ${ibm.variable} font-mono antialiased`}>
        <a
          href="#content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:bg-void focus:px-3 focus:py-2 focus:text-acid"
        >
          Skip to content
        </a>
        <div className="relative z-10 flex min-h-screen flex-col">
          <SiteHeader />
          <main
            id="content"
            className="mx-auto w-full max-w-7xl flex-1 px-4 pb-16 pt-8 sm:px-6"
          >
            {children}
          </main>
          <SiteFooter />
        </div>
        <CommandPaletteProvider />
        <Analytics />
        <Script id="sc-vars" strategy="afterInteractive">
          {`var sc_project=13354311; var sc_invisible=1; var sc_security="479323c8";`}
        </Script>
        <Script
          src="https://www.statcounter.com/counter/counter.js"
          strategy="afterInteractive"
        />
        <noscript>
          <div className="statcounter">
            <a title="web stats" href="https://statcounter.com/" target="_blank" rel="noreferrer">
              <img
                className="statcounter"
                src="https://c.statcounter.com/13354311/0/479323c8/1/"
                alt="web stats"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </a>
          </div>
        </noscript>
      </body>
    </html>
  );
}
