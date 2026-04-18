import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MMI International References",
  description: "Interactive reference map for M Mérnöki Iroda Kft.",
  manifest: "/mmi-data/mmi-app.webmanifest",
  appleWebApp: {
    capable: true,
    title: "MMI Map",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#263f50",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
