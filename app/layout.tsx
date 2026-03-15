import type { Metadata } from "next";
import "./globals.css";

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
      <body className="antialiased">{children}</body>
    </html>
  );
}
