import type { Metadata, Viewport } from "next";
import { Rubik, Geist_Mono, Geist } from "next/font/google";

import Providers from "./providers";
import "./globals.css";
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

const rubik = Rubik({
  variable: "--font-rubik",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#79565D",
};

export const metadata: Metadata = {
  title: {
    default: "Orderly | Kirana B2B Wholesale Ordering",
    template: "%s | Orderly",
  },
  description:
    "Orderly is an AI-powered B2B FMCG wholesale ordering platform for Kirana stores and distributors with Hindi voice & parchi OCR order capture, real-time schemes, offline salesman portal, and warehouse dispatch.",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: [
      { url: "/icon-192.svg", sizes: "192x192", type: "image/svg+xml" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Orderly",
  },
};

export default function RootLayout({
  children,
}: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={cn("h-full", "antialiased", rubik.variable, geistMono.variable, "font-sans", geist.variable)}
    >
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icon-192.svg" />
      </head>
      <body className="min-h-full flex flex-col font-normal overflow-x-hidden">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
