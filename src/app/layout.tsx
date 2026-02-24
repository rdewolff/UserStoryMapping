import type { Metadata } from "next";

import "./globals.css";

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
      <body>{children}</body>
    </html>
  );
}
