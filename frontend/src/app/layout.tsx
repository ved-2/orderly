import type { Metadata } from "next";
import { Rubik, Geist_Mono, Geist } from "next/font/google";

import Providers from "./providers";
import "./globals.css";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

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

export const metadata: Metadata = {
  title: "Orderly | Distribution Operations",
  description:
    "Manage product ordering, retailer pricing, schemes and order operations in one platform.",
};

export default function RootLayout({
  children,
}: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={cn("h-full", "antialiased", rubik.variable, geistMono.variable, "font-sans", geist.variable)}
    >
      <body className="min-h-full flex flex-col font-normal">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
