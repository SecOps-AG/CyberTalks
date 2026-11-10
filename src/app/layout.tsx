import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { IBM_Plex_Mono, Orbitron } from "next/font/google";
import { SiteBanner } from "@/components/SiteBanner";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { CommandPaletteProvider } from "@/components/CommandPaletteProvider";
import { PushPage } from "@/components/push/PushPage";
import {
  DEFAULT_OG_IMAGE_ALT,
  DEFAULT_OG_IMAGE_SIZE,
  SITE_DESCRIPTION,
  defaultOgImageUrl,
} from "@/lib/page-meta";
import { siteUrl } from "@/lib/site-url";
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

const baseUrl = siteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: "Cyber Talks",
    template: "%s — Cyber Talks",
  },
  description: SITE_DESCRIPTION,
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    type: "website",
    siteName: "Cyber Talks",
    images: [{ url: defaultOgImageUrl(), ...DEFAULT_OG_IMAGE_SIZE, alt: DEFAULT_OG_IMAGE_ALT }],
  },
  twitter: { card: "summary_large_image", images: [defaultOgImageUrl()] },
};

export const viewport: Viewport = { themeColor: "#050805" };

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
        <PushPage>
          <div className="relative z-10 flex min-h-screen flex-col">
            <SiteHeader />
            <SiteBanner />
            <main
              id="content"
              className="mx-auto w-full max-w-7xl flex-1 px-4 pb-16 pt-8 max-[599px]:pt-3 sm:px-6"
            >
              {children}
            </main>
            <SiteFooter />
          </div>
        </PushPage>
        <CommandPaletteProvider />
        <Script
          defer
          src="https://cloud.umami.is/script.js"
          data-website-id="39a1148d-77a4-4f95-926a-5693a5e388c4"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
