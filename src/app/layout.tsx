import type { Metadata } from "next";
import { Geist, Playfair_Display } from "next/font/google";

import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "User Story Mapping",
  description: "Visual user story mapping board with drag-and-drop planning.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geist.variable} ${playfair.variable}`}>{children}</body>
    </html>
  );
}
