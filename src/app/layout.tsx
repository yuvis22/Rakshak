import type { Metadata } from "next";
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
  title: "Rakshak · AI scam shield, powered by Mesh",
  description:
    "Paste a suspicious SMS, WhatsApp forward, or email and Rakshak checks it across multiple AI models via the Mesh API. Built for the Mesh API Hackathon 2026.",
  openGraph: {
    title: "Rakshak · Is this message a scam?",
    description:
      "AI scam shield for India. Check suspicious SMS, WhatsApp, email, screenshots, or voice notes — powered entirely by the Mesh API.",
    type: "website",
    siteName: "Rakshak",
  },
  twitter: {
    card: "summary_large_image",
    title: "Rakshak · AI scam shield",
    description: "Check any suspicious message across multiple AI models via Mesh.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
