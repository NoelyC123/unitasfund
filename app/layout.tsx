import type { Metadata } from "next";
import "./globals.css";
import CookieBanner from "@/components/CookieBanner";
import { Playfair_Display, DM_Sans } from "next/font/google";

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-heading",
  weight: ["400", "600", "700"],
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "UnitasFund — Funding · Strategy · Growth",
  description: "UK funding intelligence platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-GB">
      <body className={`${playfair.variable} ${dmSans.variable}`}>
        {children}
        <CookieBanner />
      </body>
    </html>
  );
}
